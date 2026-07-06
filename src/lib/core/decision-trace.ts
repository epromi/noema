import type { AllProviders, Message, Session } from "$lib/providers/types";
import { getProvider } from "$lib/providers";
import type {
  DecisionBottleneck,
  DecisionLoop,
  DecisionStep,
  DecisionTrace,
  DecisionTraceData,
  DecisionTraceSessionOption,
} from "$lib/types";

const MAX_SESSIONS = 15;
const MAX_STEPS = 200;
const DEFAULT_BOTTLENECK_MS = 5_000;
const PREVIEW_LEN = 240;

interface PendingStep {
  id: string;
  toolName: string;
  arguments: Record<string, unknown>;
  timestampMs: number;
  triggeredBy?: string;
}

interface ToolResultPayload {
  toolCallId?: string;
  toolName?: string;
  content?: unknown;
  isError?: boolean;
  details?: {
    durationMs?: number;
    status?: string;
  };
}

function previewValue(value: unknown, max = PREVIEW_LEN): string {
  if (value == null) return "";
  if (typeof value === "string") {
    const trimmed = value.replace(/\s+/g, " ").trim();
    return trimmed.length <= max ? trimmed : `${trimmed.slice(0, max)}…`;
  }
  try {
    const text = JSON.stringify(value);
    return text.length <= max ? text : `${text.slice(0, max)}…`;
  } catch {
    return String(value).slice(0, max);
  }
}

function previewArguments(args: Record<string, unknown>): string {
  const keys = Object.keys(args);
  if (keys.length === 0) return "(no args)";
  if (keys.length === 1 && keys[0] === "command") {
    return previewValue(args.command, PREVIEW_LEN);
  }
  return previewValue(args, PREVIEW_LEN);
}

function extractTextContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return previewValue(content);
  const parts: string[] = [];
  for (const block of content) {
    if (block && typeof block === "object" && "text" in block) {
      parts.push(String((block as { text?: string }).text ?? ""));
    }
  }
  return parts.join("\n").trim();
}

function parseTimestamp(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const ms = Date.parse(value);
    if (Number.isFinite(ms)) return ms;
  }
  return fallback;
}

function stepSignature(
  toolName: string,
  args: Record<string, unknown>,
): string {
  const keys = Object.keys(args).sort();
  const normalized: Record<string, unknown> = {};
  for (const key of keys) {
    normalized[key] = args[key];
  }
  return `${toolName}:${previewValue(normalized, 120)}`;
}

function isTrajectoryRole(role: string): boolean {
  return role === "tool.call" || role === "tool.result";
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

/** Build decision steps from session messages or trajectory events. */
export function parseHistoryMessages(
  messages: Message[],
  sessionKey: string,
  maxSteps = MAX_STEPS,
): DecisionStep[] {
  const pending = new Map<string, PendingStep>();
  const ordered: DecisionStep[] = [];
  let previousStepId: string | undefined;
  let seq = 0;

  function finalizePending(id: string, result: ToolResultPayload, ts: number) {
    const call = pending.get(id);
    if (!call) return;

    const outputText = extractTextContent(result.content);
    const latencyMs =
      result.details?.durationMs ??
      (call.timestampMs > 0 && ts >= call.timestampMs
        ? ts - call.timestampMs
        : undefined);
    const isError =
      result.isError === true ||
      result.details?.status === "failed" ||
      result.details?.status === "error";

    ordered.push({
      id: call.id,
      index: seq++,
      toolName: call.toolName,
      arguments: call.arguments,
      argumentsPreview: previewArguments(call.arguments),
      outputPreview: previewValue(outputText || "(empty output)"),
      timestampMs: call.timestampMs,
      latencyMs,
      isError,
      triggeredBy: call.triggeredBy ?? previousStepId ?? "user",
      isLoop: false,
      isBottleneck: false,
    });

    previousStepId = call.id;
    pending.delete(id);
  }

  for (const message of messages) {
    if (ordered.length >= maxSteps) break;

    const role = message.role;
    const ts = parseTimestamp(
      message.timestamp,
      ordered.at(-1)?.timestampMs ?? Date.now(),
    );

    if (isTrajectoryRole(role)) {
      const data = asRecord(message.content);

      if (role === "tool.call") {
        const toolCallId = String(data.toolCallId ?? `step-${seq}`);
        pending.set(toolCallId, {
          id: toolCallId,
          toolName: String(data.name ?? message.toolName ?? "unknown"),
          arguments: asRecord(data.arguments),
          timestampMs: ts,
          triggeredBy: previousStepId ?? "user",
        });
        continue;
      }

      const result: ToolResultPayload = data.message
        ? (asRecord(data.message) as ToolResultPayload)
        : {
            toolCallId:
              typeof data.toolCallId === "string" ? data.toolCallId : undefined,
            toolName:
              typeof data.toolName === "string"
                ? data.toolName
                : message.toolName,
            content: data.content ?? data.message,
            isError:
              typeof data.isError === "boolean" ? data.isError : undefined,
            details: asRecord(data.details) as ToolResultPayload["details"],
          };

      const toolCallId = String(result.toolCallId ?? "");
      if (toolCallId) finalizePending(toolCallId, result, ts);
      continue;
    }

    const content = message.content;

    if (role === "assistant" || role === "toolUse") {
      const blocks = Array.isArray(content) ? content : [content];
      for (const block of blocks) {
        if (!block || typeof block !== "object") continue;
        const typed = block as Record<string, unknown>;
        if (typed.type !== "toolCall" && typed.type !== "tool_use") continue;

        const toolCallId = String(
          typed.id ?? typed.toolCallId ?? `step-${seq}`,
        );
        pending.set(toolCallId, {
          id: toolCallId,
          toolName: String(typed.name ?? message.toolName ?? "unknown"),
          arguments: asRecord(typed.arguments ?? typed.input),
          timestampMs: ts,
          triggeredBy: previousStepId ?? "user",
        });
      }
      continue;
    }

    if (role === "toolResult" || role === "tool") {
      const payload = asRecord(content) as ToolResultPayload;
      const fromMessage: ToolResultPayload = {
        toolCallId:
          payload.toolCallId ??
          (message as Message & { toolCallId?: string }).toolCallId,
        toolName: payload.toolName ?? message.toolName,
        content: payload.content ?? content,
        isError: payload.isError,
        details: payload.details,
      };
      const toolCallId = String(fromMessage.toolCallId ?? "");
      if (toolCallId) finalizePending(toolCallId, fromMessage, ts);
    }
  }

  for (const call of pending.values()) {
    if (ordered.length >= maxSteps) break;
    ordered.push({
      id: call.id,
      index: seq++,
      toolName: call.toolName,
      arguments: call.arguments,
      argumentsPreview: previewArguments(call.arguments),
      outputPreview: "(no result yet)",
      timestampMs: call.timestampMs,
      isError: false,
      triggeredBy: call.triggeredBy ?? previousStepId ?? "user",
      isLoop: false,
      isBottleneck: false,
    });
  }

  return applyStepFlags(ordered, sessionKey).slice(0, maxSteps);
}

function applyStepFlags(
  steps: DecisionStep[],
  _sessionKey: string,
): DecisionStep[] {
  const loops = detectLoops(steps);
  const bottlenecks = detectBottlenecks(steps);
  const loopIds = new Set(loops.flatMap((loop) => loop.stepIds));
  const bottleneckIds = new Set(bottlenecks.map((b) => b.stepId));

  return steps.map((step) => ({
    ...step,
    isLoop: loopIds.has(step.id),
    isBottleneck: bottleneckIds.has(step.id),
  }));
}

/** Detect repeated tool+argument patterns (2+ occurrences). */
export function detectLoops(steps: DecisionStep[]): DecisionLoop[] {
  const groups = new Map<string, { toolName: string; stepIds: string[] }>();

  for (const step of steps) {
    const signature = stepSignature(step.toolName, step.arguments);
    const existing = groups.get(signature);
    if (existing) {
      existing.stepIds.push(step.id);
    } else {
      groups.set(signature, { toolName: step.toolName, stepIds: [step.id] });
    }
  }

  const loops: DecisionLoop[] = [];
  for (const [signature, group] of groups) {
    if (group.stepIds.length < 2) continue;
    loops.push({
      toolName: group.toolName,
      signature,
      stepIds: group.stepIds,
      count: group.stepIds.length,
    });
  }

  return loops.sort((a, b) => b.count - a.count);
}

/** Flag slow tool calls above threshold (default 5s). */
export function detectBottlenecks(
  steps: DecisionStep[],
  thresholdMs = DEFAULT_BOTTLENECK_MS,
): DecisionBottleneck[] {
  const bottlenecks: DecisionBottleneck[] = [];

  for (const step of steps) {
    if (step.latencyMs != null && step.latencyMs >= thresholdMs) {
      bottlenecks.push({
        stepId: step.id,
        toolName: step.toolName,
        latencyMs: step.latencyMs,
      });
    }
  }

  return bottlenecks.sort((a, b) => b.latencyMs - a.latencyMs);
}

function sessionLabel(session: Session): string {
  const agent = session.agentId ?? "unknown";
  const shortKey = session.key.split(":").slice(2).join(":") || session.key;
  return `${agent} · ${shortKey}`;
}

function emptyTrace(sessionKey: string, error?: string): DecisionTrace {
  return {
    sessionKey,
    steps: [],
    loops: [],
    bottlenecks: [],
    updatedAt: Date.now(),
    error,
  };
}

/**
 * Parse tool call timeline for a single session.
 */
export async function getDecisionTrace(
  sessionKey: string,
  providers?: AllProviders,
): Promise<DecisionTrace> {
  const p = providers ?? getProvider();
  const nowMs = Date.now();

  try {
    const sessions = await p.session.listSessions({ limit: 500 });
    const session = sessions.find((s) => s.key === sessionKey);
    const messages = await p.session.getHistory(sessionKey);
    const steps = parseHistoryMessages(messages, sessionKey);

    return {
      sessionKey,
      agentId: session?.agentId,
      steps,
      loops: detectLoops(steps),
      bottlenecks: detectBottlenecks(steps),
      updatedAt: nowMs,
    };
  } catch (err) {
    return {
      ...emptyTrace(sessionKey, String(err)),
      error: String(err),
    };
  }
}

/**
 * Load recent sessions and their decision traces for the dashboard tab.
 */
export async function getDecisionTraceData(
  providers?: AllProviders,
): Promise<DecisionTraceData> {
  const p = providers ?? getProvider();
  const nowMs = Date.now();

  try {
    const sessions = await p.session.listSessions({ limit: 500 });
    const sorted = [...sessions].sort(
      (a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0),
    );
    const selected = sorted.slice(0, MAX_SESSIONS);

    const sessionOptions: DecisionTraceSessionOption[] = selected.map((s) => ({
      key: s.key,
      agentId: s.agentId,
      label: sessionLabel(s),
      updatedAt: s.updatedAt,
    }));

    const traces: Record<string, DecisionTrace> = {};
    await Promise.all(
      selected.map(async (session) => {
        traces[session.key] = await getDecisionTrace(session.key, p);
      }),
    );

    const defaultSessionKey = selected[0]?.key ?? "";

    return {
      sessions: sessionOptions,
      traces,
      defaultSessionKey,
      updatedAt: nowMs,
    };
  } catch (err) {
    return {
      sessions: [],
      traces: {},
      defaultSessionKey: "",
      updatedAt: nowMs,
      error: String(err),
    };
  }
}
