import { describe, it, expect } from "vitest";
import type { DevPackageEntry } from "$lib/types";
import {
  computePackageStats,
  filterPackages,
  groupPackages,
  isActivePackage,
  isBlockedPackage,
  isDonePackage,
  phaseIcon,
  truncateName,
} from "$lib/core/dev-packages";

const fixtures: DevPackageEntry[] = [
  { id: "PKG-001", name: "SvelteKit Scaffold", phase: "✅ F5", done: true },
  { id: "PKG-008", name: "Cron Health Timeline", phase: "📋 F0", done: false },
  { id: "PKG-014", name: "Dev Loop Log Viewer", phase: "🔨 F2", done: false },
  { id: "PKG-099", name: "Blocked Item", phase: "⏸️ F3", done: false },
];

describe("dev-packages", () => {
  it("groupPackages splits spec, active, and done", () => {
    const grouped = groupPackages(fixtures);
    expect(grouped.done.map((p) => p.id)).toEqual(["PKG-001"]);
    expect(grouped.spec.map((p) => p.id)).toEqual(["PKG-008"]);
    expect(grouped.active.map((p) => p.id)).toEqual(["PKG-014", "PKG-099"]);
  });

  it("groupPackages sorts spec/active ascending and done descending by PKG#", () => {
    const unordered: DevPackageEntry[] = [
      { id: "PKG-040", name: "Newest Done", phase: "✅ F5", done: true },
      { id: "PKG-001", name: "Oldest Done", phase: "✅ F5", done: true },
      { id: "PKG-053", name: "Newest Spec", phase: "📋 F0", done: false },
      { id: "PKG-008", name: "Oldest Spec", phase: "📋 F0", done: false },
    ];
    const grouped = groupPackages(unordered);
    expect(grouped.done.map((p) => p.id)).toEqual(["PKG-040", "PKG-001"]);
    expect(grouped.spec.map((p) => p.id)).toEqual(["PKG-008", "PKG-053"]);
  });

  it("groupPackages treats unrecognized phases as active (not spec)", () => {
    const withUnknown: DevPackageEntry[] = [
      { id: "PKG-047", name: "In Progress", phase: "🔧 IP", done: false },
      { id: "PKG-048", name: "QA Running", phase: "🤖 QA", done: false },
      { id: "PKG-099", name: "Totally Unknown", phase: "???", done: false },
    ];
    const grouped = groupPackages(withUnknown);
    expect(grouped.spec).toHaveLength(0);
    expect(grouped.active.map((p) => p.id)).toEqual([
      "PKG-047",
      "PKG-048",
      "PKG-099",
    ]);
  });

  it("isActivePackage recognizes IP and QA phase markers", () => {
    expect(isActivePackage({ id: "PKG-047", name: "x", phase: "🔧 IP", done: false })).toBe(true);
    expect(isActivePackage({ id: "PKG-048", name: "x", phase: "🤖 QA", done: false })).toBe(true);
    expect(isActivePackage({ id: "PKG-008", name: "x", phase: "📋 F0", done: false })).toBe(false);
  });

  it("isDonePackage prefers done flag and F5 phase", () => {
    expect(isDonePackage(fixtures[0]!)).toBe(true);
    expect(isDonePackage(fixtures[1]!)).toBe(false);
  });

  it("isBlockedPackage detects pause emoji", () => {
    expect(isBlockedPackage(fixtures[3]!)).toBe(true);
    expect(isBlockedPackage(fixtures[2]!)).toBe(false);
  });

  it("filterPackages matches id, name, and phase case-insensitively", () => {
    expect(filterPackages(fixtures, "pkg-008")).toHaveLength(1);
    expect(filterPackages(fixtures, "CRON")).toHaveLength(1);
    expect(filterPackages(fixtures, "f0")).toHaveLength(1);
    expect(filterPackages(fixtures, "")).toHaveLength(fixtures.length);
  });

  it("computePackageStats returns accurate counts and percent", () => {
    const stats = computePackageStats(fixtures);
    expect(stats).toEqual({
      total: 4,
      spec: 1,
      active: 2,
      done: 1,
      donePercent: 25,
    });
  });

  it("phaseIcon extracts leading emoji", () => {
    expect(phaseIcon("📋 F0")).toBe("📋");
    expect(phaseIcon("✅ F5")).toBe("✅");
  });

  it("truncateName ellipsizes long names and strips markdown", () => {
    expect(truncateName("Short")).toBe("Short");
    const long = truncateName(
      "**Provider Abstraction Layer With Extra Words** 🧱",
    );
    expect(long.endsWith("…")).toBe(true);
    expect(long.length).toBeLessThanOrEqual(30);
    expect(long).toContain("Provider Abstraction");
  });
});
