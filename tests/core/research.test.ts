import { describe, it, expect, vi, beforeEach } from "vitest";
import { getResearch } from "$lib/core/research";
import { createMockProviders } from "./mock-providers";

vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs/promises")>();
  return {
    ...actual,
    readdir: vi.fn(
      async (dir: string, options?: { withFileTypes?: boolean }) => {
        const d = String(dir);
        if (options?.withFileTypes) {
          if (
            d.endsWith("memory/research/noema") ||
            d.endsWith("research/noema")
          ) {
            return [
              { name: "2026-07-05.md", isDirectory: () => false },
            ] as unknown as Awaited<ReturnType<typeof actual.readdir>>;
          }
          if (d.endsWith("memory/research")) {
            return [
              { name: "noema", isDirectory: () => true },
            ] as unknown as Awaited<ReturnType<typeof actual.readdir>>;
          }
          if (d.endsWith("memory/nightly") || d.endsWith("nightly")) {
            return [
              {
                name: "nightly-review-2026-07-05.md",
                isDirectory: () => false,
              },
            ] as unknown as Awaited<ReturnType<typeof actual.readdir>>;
          }
          return [];
        }
        if (
          d.endsWith("memory/research/noema") ||
          d.endsWith("research/noema")
        ) {
          return ["2026-07-05.md"] as unknown as Awaited<
            ReturnType<typeof actual.readdir>
          >;
        }
        if (d.endsWith("memory/nightly") || d.endsWith("nightly")) {
          return ["nightly-review-2026-07-05.md"] as unknown as Awaited<
            ReturnType<typeof actual.readdir>
          >;
        }
        return [] as unknown as Awaited<ReturnType<typeof actual.readdir>>;
      },
    ),
    stat: vi.fn(async () => ({ mtimeMs: Date.now() })),
  };
});

describe("research", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getResearch returns research stats via provider", async () => {
    const data = await getResearch(createMockProviders());
    expect(data.latestDate).toBe("2026-07-05");
    expect(data.proposals.length).toBeGreaterThan(0);
    expect(data.proposals[0]?.id).toBe("P-1");
    expect(data.proposals[0]?.finding).toBe("Test finding");
    expect(data.proposals[0]?.actions).toEqual(["implement", "done"]);
    expect(data.proposals[1]?.actions).toEqual(["implement"]);
    expect(data.updatedAt).toBeGreaterThan(0);
  });

  it("getResearch includes otto nightly runs", async () => {
    const data = await getResearch(createMockProviders());
    expect(data.ottoRuns.length).toBeGreaterThan(0);
    expect(data.ottoRuns[0]?.date).toBe("2026-07-05");
    expect(data.ottoRuns[0]?.status).toBe("ok");
    expect(data.ottoRuns[0]?.steps.length).toBeGreaterThan(0);
  });
});
