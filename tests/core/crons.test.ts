import { describe, it, expect } from "vitest";
import { getCrons } from "$lib/core/crons";
import { classifyCronGroup } from "$lib/core/utils";
import { createMockProviders } from "./mock-providers";

describe("crons", () => {
  it("classifyCronGroup assigns time groups", () => {
    expect(classifyCronGroup("02:30 daily")).toBe("NIGHT");
    expect(classifyCronGroup("07:00 daily")).toBe("MORNING");
    expect(classifyCronGroup("12:00 daily")).toBe("DAYTIME");
    expect(classifyCronGroup("20:00 daily")).toBe("EVENING");
    expect(classifyCronGroup({ kind: "every", everyMs: 7200000 })).toBe(
      "SPANNING",
    );
  });

  it("getCrons returns classified cron data via provider", async () => {
    const data = await getCrons(createMockProviders());
    expect(data.total).toBe(2);
    expect(data.healthy).toBe(1);
    expect(data.crons[0]?.lastResult).toBe("ok");
    expect(data.byGroup.SPANNING).toEqual({ total: 1, healthy: 1 });
    expect(data.byGroup.NIGHT).toEqual({ total: 1, healthy: 0 });
    expect(data.updatedAt).toBeGreaterThan(0);
    expect(data.error).toBeUndefined();
  });

  it("getCrons handles provider errors", async () => {
    const mock = createMockProviders({
      cron: {
        listCrons: async () => {
          throw new Error("cron unavailable");
        },
        runCron: async () => {},
        getCronStatus: async () => ({
          enabled: false,
          jobsTotal: 0,
          jobsEnabled: 0,
        }),
        getCronRuns: async () => [],
      },
    });
    const data = await getCrons(mock);
    expect(data.error).toContain("cron unavailable");
    expect(data.crons).toEqual([]);
    expect(data.byGroup.MORNING).toEqual({ total: 0, healthy: 0 });
  });
});
