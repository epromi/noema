/** @file Dev package utilities: grouping, filtering, stats computation, phase icons. */

import type { DevPackageEntry } from "$lib/types";

export interface GroupedPackages {
  spec: DevPackageEntry[];
  active: DevPackageEntry[];
  done: DevPackageEntry[];
}

export interface PackageStats {
  total: number;
  spec: number;
  active: number;
  done: number;
  donePercent: number;
}

export function isDonePackage(pkg: DevPackageEntry): boolean {
  return pkg.done || /F5/.test(pkg.phase);
}

export function isActivePackage(pkg: DevPackageEntry): boolean {
  return /F[1-4]|🔨|⏸|🔧|🤖|\b(IP|QA)\b/.test(pkg.phase);
}

/** Extract the leading numeric PKG id (e.g. "PKG-014" → 14) for sorting. */
function pkgNum(pkg: DevPackageEntry): number {
  const m = /^(\d+)/.exec(pkg.id.replace(/^PKG-/, ""));
  return m?.[1] ? Number.parseInt(m[1], 10) : 0;
}

export function isSpecPackage(pkg: DevPackageEntry): boolean {
  return /F0|📋/.test(pkg.phase);
}

export function isBlockedPackage(pkg: DevPackageEntry): boolean {
  return /⏸/.test(pkg.phase);
}

/**
 * Split packages into spec / active / done buckets (mutually exclusive),
 * then sort each bucket:
 * - spec: oldest first (ascending PKG#)
 * - active: oldest first (ascending PKG#)
 * - done: newest first (descending PKG#)
 *
 * Packages with an unrecognized phase fall back to `active` rather than
 * `spec`, since an unknown phase most likely means "in progress" work that
 * doesn't match a known marker yet.
 */
export function groupPackages(pkgs: DevPackageEntry[]): GroupedPackages {
  const spec: DevPackageEntry[] = [];
  const active: DevPackageEntry[] = [];
  const done: DevPackageEntry[] = [];

  for (const pkg of pkgs) {
    if (isDonePackage(pkg)) {
      done.push(pkg);
    } else if (isActivePackage(pkg)) {
      active.push(pkg);
    } else if (isSpecPackage(pkg)) {
      spec.push(pkg);
    } else {
      active.push(pkg);
    }
  }

  spec.sort((a, b) => pkgNum(a) - pkgNum(b));
  active.sort((a, b) => pkgNum(a) - pkgNum(b));
  done.sort((a, b) => pkgNum(b) - pkgNum(a));

  return { spec, active, done };
}

/**
 * Case-insensitive filter by PKG id, name, or phase string.
 */
export function filterPackages(
  pkgs: DevPackageEntry[],
  query: string,
): DevPackageEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return pkgs;

  return pkgs.filter((pkg) => {
    const haystack = `${pkg.id} ${pkg.name} ${pkg.phase}`.toLowerCase();
    return haystack.includes(q);
  });
}

/** Aggregate counts for the progress bar and summary chips. */
export function computePackageStats(pkgs: DevPackageEntry[]): PackageStats {
  const grouped = groupPackages(pkgs);
  const total = pkgs.length;
  const done = grouped.done.length;
  const donePercent = total > 0 ? Math.round((done / total) * 100) : 0;

  return {
    total,
    spec: grouped.spec.length,
    active: grouped.active.length,
    done,
    donePercent,
  };
}

/** Extract leading emoji/icon from a phase label for compact rows. */
export function phaseIcon(phase: string): string {
  const match = phase.match(/^[^\s]+/);
  return match?.[0] ?? phase.slice(0, 2);
}

/** Truncate package name for compact display. */
export function truncateName(name: string, maxLen = 30): string {
  const stripped = name.replace(/\*\*/g, "").trim();
  if (stripped.length <= maxLen) return stripped;
  return `${stripped.slice(0, maxLen - 1)}…`;
}
