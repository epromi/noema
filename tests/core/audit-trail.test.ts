import { describe, it, expect } from "vitest";
import {
  buildActionEvents,
  buildCronEvents,
  buildSessionEvents,
  buildSpawnEvents,
  filterAuditEvents,
  getAuditTrail,
  mergeAuditEvents,
  sessionStartMs,
} from "$lib/core/audit-trail";
import type { CronRun, Session, Subagent } from "$lib/providers/types";
import { createMockProviders } from "./mock-providers";

describe("audit-trail", () => {
  it("sessionStartMs prefers updatedAt minus ageMs", () => {
    expect(
      sessionStartMs({ key: "k", updatedAt: 10_000, ageMs: 2_000 }),
    ).toBe(8_000);
    expect(sessionStartMs({ key: "k", updatedAt: 5_000 })).toBe(5_000);
    expect(sessionStartMs({ key: "k" })).toBeUndefined();
  });

  it("buildSessionEvents creates SESSION_START entries", () => {
    const sessions: Session[] = [
      {
        key: "agent:alfred:main",
        agentId: "alfred",
        updatedAt: 1_000_000,
        ageMs: 10_000,
      },
    ];
    const events = buildSessionEvents(sessions);
    expect(events).toHaveLength(1);
    expect(events[0]?.type).toBe("SESSION_START");
    expect(events[0]?.timestampMs).toBe(990_000);
    expect(events[0]?.sessionKey).toBe("agent:alfred:main");
  });

  it("buildCronEvents maps trigger, complete, and error runs", () => {
    const runs: CronRun[] = [
      {
        jobId: "job-1",
        startedAtMs: 100,
        finishedAtMs: 200,
        status: "ok",
        durationMs: 1500,
      },
      {
        jobId: "job-2",
        startedAtMs: 300,
        finishedAtMs: 400,
        status: "error",
        error: "timeout",
      },
    ];
    const names = new Map([
      ["job-1", "Nightly QA"],
      ["job-2", "Failed Job"],
    ]);
    const events = buildCronEvents(runs, names);
    expect(events.map((e) => e.type)).toEqual([
      "CRON_TRIGGER",
      "CRON_COMPLETE",
      "CRON_TRIGGER",
      "ERROR",
    ]);
    expect(events[3]?.title).toContain("Failed Job");
    expect(events[3]?.severity).toBe("error");
  });

  it("buildSpawnEvents creates AGENT_SPAWN entries", () => {
    const subagents: Subagent[] = [
      {
        id: "t1",
        target: "agent:viktor:audit",
        agentId: "viktor",
        status: "running",
        startedAtMs: 500,
        label: "repo audit",
      },
    ];
    const events = buildSpawnEvents(subagents);
    expect(events[0]?.type).toBe("AGENT_SPAWN");
    expect(events[0]?.agentId).toBe("viktor");
    expect(events[0]?.detail).toBe("repo audit");
  });

  it("buildActionEvents parses JSONL action lines", () => {
    const raw = [
      JSON.stringify({
        id: "P-01",
        action: "implement",
        description: "Add logs tab",
        status: "queued",
        ts: "2026-07-05T10:00:00.000Z",
      }),
      JSON.stringify({
        id: "P-02",
        action: "done",
        status: "failed",
        updatedAt: "2026-07-05T11:00:00.000Z",
      }),
    ].join("\n");

    const events = buildActionEvents(raw);
    expect(events).toHaveLength(2);
    expect(events[0]?.type).toBe("ACTION");
    expect(events[1]?.severity).toBe("error");
  });

  it("mergeAuditEvents sorts newest first", () => {
    const merged = mergeAuditEvents([
      {
        id: "a",
        type: "ACTION",
        timestampMs: 100,
        title: "old",
        severity: "warn",
      },
      {
        id: "b",
        type: "SESSION_START",
        timestampMs: 300,
        title: "new",
        severity: "info",
      },
    ]);
    expect(merged[0]?.timestampMs).toBe(300);
  });

  it("filterAuditEvents applies session, agent, type, and time range", () => {
    const now = 1_000_000;
    const events = [
      {
        id: "1",
        type: "SESSION_START" as const,
        timestampMs: now - 1_000,
        title: "alfred",
        agentId: "alfred",
        sessionKey: "agent:alfred:main",
        severity: "info" as const,
      },
      {
        id: "2",
        type: "AGENT_SPAWN" as const,
        timestampMs: now - MS_DAY - 1,
        title: "viktor",
        agentId: "viktor",
        sessionKey: "agent:viktor:spawn",
        severity: "info" as const,
      },
      {
        id: "3",
        type: "ERROR" as const,
        timestampMs: now - MS_WEEK - 1,
        title: "old error",
        severity: "error" as const,
      },
    ];

    expect(
      filterAuditEvents(events, { sessionKey: "agent:alfred:main" }, now),
    ).toHaveLength(1);
    expect(filterAuditEvents(events, { agentId: "viktor" }, now)).toHaveLength(
      1,
    );
    expect(
      filterAuditEvents(events, { eventType: "ERROR" }, now),
    ).toHaveLength(1);
    expect(filterAuditEvents(events, { timeRange: "24h" }, now)).toHaveLength(
      1,
    );
    expect(filterAuditEvents(events, { timeRange: "7d" }, now)).toHaveLength(
      2,
    );
  });

  it("getAuditTrail aggregates provider data", async () => {
    const now = Date.now();
    const providers = createMockProviders({
      session: {
        ...createMockProviders().session,
        listSessions: async () => [
          {
            key: "agent:alfred:main",
            agentId: "alfred",
            updatedAt: now,
            ageMs: 5_000,
          },
        ],
      },
      cron: {
        ...createMockProviders().cron,
        listCrons: async () => [
          {
            id: "cron-1",
            name: "QA Cron",
            enabled: true,
            schedule: "03:00 daily",
          },
        ],
        getCronRuns: async () => [
          {
            jobId: "cron-1",
            startedAtMs: now - 60_000,
            finishedAtMs: now - 30_000,
            status: "ok",
          },
        ],
      },
      agent: {
        ...createMockProviders().agent,
        listSubagents: async () => [
          {
            id: "sub-1",
            target: "agent:viktor:audit",
            agentId: "viktor",
            status: "running",
            startedAtMs: now - 10_000,
          },
        ],
      },
      filesystem: {
        ...createMockProviders().filesystem,
        readState: async (path) => {
          if (path === "noema-actions.jsonl") {
            return `${JSON.stringify({
              id: "P-99",
              action: "implement",
              description: "Audit trail",
              ts: new Date(now - 5_000).toISOString(),
            })}\n`;
          }
          return "{}";
        },
      },
    });

    const data = await getAuditTrail(providers);
    expect(data.error).toBeUndefined();
    expect(data.events.length).toBeGreaterThan(0);
    expect(data.total).toBeGreaterThanOrEqual(data.events.length);
    expect(data.sessions).toContain("agent:alfred:main");
    expect(data.agents).toContain("alfred");
    expect(data.counts.SESSION_START).toBeGreaterThan(0);
    expect(data.counts.CRON_TRIGGER).toBeGreaterThan(0);
    expect(data.counts.AGENT_SPAWN).toBeGreaterThan(0);
    expect(data.counts.ACTION).toBeGreaterThan(0);
    expect(data.updatedAt).toBeGreaterThan(0);
  });

  it("getAuditTrail handles provider errors", async () => {
    const providers = createMockProviders({
      session: {
        ...createMockProviders().session,
        listSessions: async () => {
          throw new Error("sessions unavailable");
        },
      },
    });

    const data = await getAuditTrail(providers);
    expect(data.error).toContain("sessions unavailable");
    expect(data.events).toEqual([]);
    expect(data.total).toBe(0);
  });
});

const MS_DAY = 24 * 60 * 60 * 1000;
const MS_WEEK = 7 * MS_DAY;
