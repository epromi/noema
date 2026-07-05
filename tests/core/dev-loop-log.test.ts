import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getDevLoopLog,
  getRunningDevLoop,
  getDevPackages,
  parsePackageIndex,
} from "$lib/core/dev-loop-log";
import { createMockProviders } from "./mock-providers";

vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs/promises")>();
  return {
    ...actual,
    readdir: vi.fn(async (dir: string) => {
      if (String(dir).endsWith("logs")) {
        return ["cursor-PKG-014-log-viewer.log", "cursor-PKG-013-other.log"];
      }
      return [];
    }),
    readFile: vi.fn(async (path: string) => {
      if (String(path).endsWith("INDEX.md")) {
        return [
          "| PKG | Név | Fázis | Roadmap | Méret | Becsült idő | Függőség |",
          "| PKG-014 | Dev Loop Log Viewer | 📋 F2 | F-05 P1 | S | 0.5h | PKG-001 |",
          "| PKG-001 | SvelteKit Scaffold | ✅ F5 | — | L | ✅ kész | — |",
        ].join("\n");
      }
      if (String(path).includes("cursor-PKG-014")) {
        return "line1\nline2\nCursor output here";
      }
      return "";
    }),
  };
});

describe("dev-loop-log", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getDevLoopLog returns tailed log content", async () => {
    const data = await getDevLoopLog("PKG-014-log-viewer");
    expect(data.pkgId).toBe("PKG-014-log-viewer");
    expect(data.content).toContain("Cursor output here");
    expect(data.updatedAt).toBeGreaterThan(0);
  });

  it("getDevLoopLog returns placeholder when log missing", async () => {
    const data = await getDevLoopLog("PKG-999");
    expect(data.content).toContain("⏳ Cursor agent dolgozik");
  });

  it("getRunningDevLoop detects running package via provider", async () => {
    const providers = createMockProviders({
      tool: {
        ...createMockProviders().tool,
        execCommand: async () =>
          "promi 12345 bash scripts/dev-loop.sh PKG-014-log-viewer",
      },
    });
    const data = await getRunningDevLoop(providers);
    expect(data.running).toBe("PKG-014-log-viewer");
  });

  it("getDevPackages parses INDEX.md rows", async () => {
    const data = await getDevPackages();
    expect(data.packages.length).toBe(2);
    expect(data.packages[0]?.id).toBe("PKG-014");
    expect(data.packages[0]?.done).toBe(false);
    expect(data.packages[1]?.done).toBe(true);
  });

  it("parsePackageIndex handles markdown table", () => {
    const rows = parsePackageIndex(
      "| PKG-002 | Cron Data | 📋 F0 | — | S | 1h | PKG-013 |",
    );
    expect(rows).toEqual([
      { id: "PKG-002", name: "Cron Data", phase: "📋 F0", done: false },
    ]);
  });
});
