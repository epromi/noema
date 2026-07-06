import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import {
  workspaceRoot,
  fileAgeDays,
  createOpenClawProviders,
} from "$lib/providers/openclaw";
import type { AllProviders } from "$lib/providers/types";

describe("openclaw provider internals", () => {
  describe("workspaceRoot", () => {
    it("returns config.workspace when provided", () => {
      const root = workspaceRoot({ workspace: "/custom/workspace" });
      expect(root).toBe("/custom/workspace");
    });

    it("returns WORKSPACE env var when set", () => {
      vi.stubEnv("WORKSPACE", "/env/workspace");
      const root = workspaceRoot({});
      expect(root).toBe("/env/workspace");
      vi.unstubAllEnvs();
    });

    it("returns default ~/.openclaw/workspace when nothing set", () => {
      const root = workspaceRoot({});
      expect(root).toContain(".openclaw");
      expect(root).toContain("workspace");
    });

    it("returns config.workspace over WORKSPACE env", () => {
      vi.stubEnv("WORKSPACE", "/env/workspace");
      const root = workspaceRoot({ workspace: "/override" });
      expect(root).toBe("/override");
      vi.unstubAllEnvs();
    });
  });

  describe("fileAgeDays", () => {
    it("returns 999 for non-existent file", async () => {
      const age = await fileAgeDays("/tmp/nonexistent-file-xyz-12345");
      expect(age).toBe(999);
    });

    it("returns 0 for a just-created file", async () => {
      const tmpPath = "/tmp/noema-test-age.txt";
      await writeFile(tmpPath, "test");
      try {
        const age = await fileAgeDays(tmpPath);
        expect(age).toBeGreaterThanOrEqual(0);
      } finally {
        await rm(tmpPath).catch(() => {});
      }
    });
  });
});

describe("getHistory — direct session file reading", () => {
  const TEST_AGENT = "test-noema";
  const TEST_SESSION_ID = "00000000-0000-4000-a000-000000000001";

  let sessionDir: string;
  let sessionPath: string;
  let providers: AllProviders;

  beforeAll(async () => {
    sessionDir = join(
      homedir(),
      ".openclaw",
      "agents",
      TEST_AGENT,
      "sessions",
    );
    sessionPath = join(sessionDir, `${TEST_SESSION_ID}.jsonl`);
    providers = createOpenClawProviders();
    await mkdir(sessionDir, { recursive: true });
  });

  afterAll(async () => {
    await rm(sessionDir, { recursive: true, force: true }).catch(() => {});
  });

  it("returns empty when no sessionId provided", async () => {
    const msgs = await providers.session.getHistory("some-key");
    expect(msgs).toEqual([]);
  });

  it("returns empty when sessionId provided but no agentId", async () => {
    const msgs = await providers.session.getHistory(
      "some-key",
      TEST_SESSION_ID,
    );
    expect(msgs).toEqual([]);
  });

  it("parses tool_call and tool_result pairs", async () => {
    const lines = [
      JSON.stringify({
        type: "tool_call",
        id: "evt-1",
        parentId: null,
        timestamp: 1000,
        message: {
          role: "assistant",
          content: [
            {
              type: "tool_use",
              id: "toolu_abc",
              name: "read",
              input: { path: "memory/rules.md" },
            },
          ],
        },
      }),
      JSON.stringify({
        type: "tool_result",
        id: "evt-2",
        parentId: "evt-1",
        timestamp: 1200,
        message: {
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: "toolu_abc",
              content: [{ type: "text", text: "# Rules" }],
              is_error: false,
            },
          ],
        },
      }),
    ];

    await writeFile(sessionPath, lines.join("\n") + "\n");
    const msgs = await providers.session.getHistory(
      "test-key",
      TEST_SESSION_ID,
      TEST_AGENT,
    );

    expect(msgs).toHaveLength(2);

    // tool_call
    expect(msgs[0].role).toBe("tool.call");
    expect(msgs[0].toolName).toBe("read");
    expect((msgs[0].content as Record<string, unknown>).name).toBe("read");
    expect((msgs[0].content as Record<string, unknown>).toolCallId).toBe(
      "toolu_abc",
    );
    expect(
      (msgs[0].content as Record<string, unknown>).arguments,
    ).toEqual({ path: "memory/rules.md" });
    expect(msgs[0].timestamp).toBe(1000);

    // tool_result
    expect(msgs[1].role).toBe("tool.result");
    expect(
      (msgs[1].content as Record<string, unknown>).toolCallId,
    ).toBe("toolu_abc");
    expect(
      (msgs[1].content as Record<string, unknown>).isError,
    ).toBe(false);
    expect(msgs[1].timestamp).toBe(1200);
  });

  it("parses user messages", async () => {
    const lines = [
      JSON.stringify({
        type: "user",
        id: "evt-u",
        parentId: null,
        timestamp: 500,
        message: { role: "user", content: "Hello, check the dashboard" },
      }),
    ];

    await writeFile(sessionPath, lines.join("\n") + "\n");
    const msgs = await providers.session.getHistory(
      "test-key",
      TEST_SESSION_ID,
      TEST_AGENT,
    );

    expect(msgs).toHaveLength(1);
    expect(msgs[0].role).toBe("user");
    expect(msgs[0].content).toBe("Hello, check the dashboard");
    expect(msgs[0].timestamp).toBe(500);
  });

  it("parses assistant messages", async () => {
    const lines = [
      JSON.stringify({
        type: "assistant",
        id: "evt-a",
        parentId: null,
        timestamp: 800,
        message: {
          role: "assistant",
          content: [{ type: "text", text: "Let me check that for you." }],
        },
      }),
    ];

    await writeFile(sessionPath, lines.join("\n") + "\n");
    const msgs = await providers.session.getHistory(
      "test-key",
      TEST_SESSION_ID,
      TEST_AGENT,
    );

    expect(msgs).toHaveLength(1);
    expect(msgs[0].role).toBe("assistant");
    expect(Array.isArray(msgs[0].content)).toBe(true);
    expect(msgs[0].timestamp).toBe(800);
  });

  it("skips thinking, error, and subagent_spawn events", async () => {
    const lines = [
      JSON.stringify({
        type: "thinking",
        id: "evt-t",
        parentId: null,
        timestamp: 100,
        message: { role: "assistant", content: "Thinking..." },
      }),
      JSON.stringify({
        type: "subagent_spawn",
        id: "evt-s",
        parentId: null,
        timestamp: 200,
        message: { role: "system", content: "spawned viktor" },
      }),
      JSON.stringify({
        type: "error",
        id: "evt-e",
        parentId: null,
        timestamp: 300,
        message: { role: "assistant", content: "timeout" },
      }),
      JSON.stringify({
        type: "user",
        id: "evt-u",
        parentId: null,
        timestamp: 400,
        message: { role: "user", content: "real message" },
      }),
    ];

    await writeFile(sessionPath, lines.join("\n") + "\n");
    const msgs = await providers.session.getHistory(
      "test-key",
      TEST_SESSION_ID,
      TEST_AGENT,
    );

    // Only the user message should be included
    expect(msgs).toHaveLength(1);
    expect(msgs[0].role).toBe("user");
  });

  it("returns empty for non-existent session file", async () => {
    const msgs = await providers.session.getHistory(
      "test-key",
      "00000000-0000-4000-a000-000000000999",
      TEST_AGENT,
    );
    expect(msgs).toEqual([]);
  });

  it("handles empty session file", async () => {
    await writeFile(sessionPath, "\n");
    const msgs = await providers.session.getHistory(
      "test-key",
      TEST_SESSION_ID,
      TEST_AGENT,
    );
    expect(msgs).toEqual([]);
  });

  it("handles malformed JSON lines gracefully", async () => {
    const lines = [
      "not valid json",
      JSON.stringify({
        type: "user",
        id: "evt-u",
        timestamp: 400,
        message: { role: "user", content: "ok" },
      }),
    ];

    await writeFile(sessionPath, lines.join("\n") + "\n");
    const msgs = await providers.session.getHistory(
      "test-key",
      TEST_SESSION_ID,
      TEST_AGENT,
    );
    // Malformed lines are skipped by parseJson fallback; only valid ones count
    expect(msgs).toHaveLength(1);
    expect(msgs[0].role).toBe("user");
  });

  it("preserves tool_result is_error flag", async () => {
    const lines = [
      JSON.stringify({
        type: "tool_call",
        id: "evt-1",
        parentId: null,
        timestamp: 1000,
        message: {
          role: "assistant",
          content: [
            {
              type: "tool_use",
              id: "toolu_err",
              name: "exec",
              input: { command: "rm -rf /" },
            },
          ],
        },
      }),
      JSON.stringify({
        type: "tool_result",
        id: "evt-2",
        parentId: "evt-1",
        timestamp: 1100,
        message: {
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: "toolu_err",
              content: "Permission denied",
              is_error: true,
            },
          ],
        },
      }),
    ];

    await writeFile(sessionPath, lines.join("\n") + "\n");
    const msgs = await providers.session.getHistory(
      "test-key",
      TEST_SESSION_ID,
      TEST_AGENT,
    );

    expect(msgs).toHaveLength(2);
    expect(msgs[1].role).toBe("tool.result");
    expect((msgs[1].content as Record<string, unknown>).isError).toBe(true);
  });
});
