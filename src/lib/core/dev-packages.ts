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

/**
 * Live pipeline states (pending/processing/failed/dead) always win over the
 * static INDEX.md phase — a package that's queued or running is "active" no
 * matter what its last recorded phase says, and one still failing isn't done.
 */
const LIVE_ACTIVE_STATUSES = new Set(["pending", "processing", "failed"]);

/** A done PKG stays in the active list for this many ms after completion. */
const DONE_GRACE_MS = 60_000;

/** After this long as "failed", a PKG is no longer considered actively failing. */
const FAILED_GRACE_MS = 30 * 60_000;

export function isDonePackage(pkg: DevPackageEntry): boolean {
  if (pkg.actionStatus === "done" || pkg.actionStatus === "resolved") return true;
  // Terminal states — not truly "done" but should not pollute active list
  if (pkg.actionStatus === "dead") return true;
  if (pkg.actionStatus && LIVE_ACTIVE_STATUSES.has(pkg.actionStatus)) {
    return false;
  }
  return pkg.done || /F5/.test(pkg.phase);
}

export function isActivePackage(pkg: DevPackageEntry): boolean {
  if (pkg.actionStatus && LIVE_ACTIVE_STATUSES.has(pkg.actionStatus)) {
    // "failed" has a grace period — after 30 min it's stale, not actively failing
    if (pkg.actionStatus === "failed" && pkg.actionUpdatedAt) {
      const elapsed = Date.now() - new Date(pkg.actionUpdatedAt).getTime();
      if (elapsed >= FAILED_GRACE_MS) return false;
    }
    return true;
  }
  // "dead" is terminal — never active (must be manually resolved)
  if (pkg.actionStatus === "dead") return false;
  // Resolved + done are NEVER active
  if (pkg.actionStatus === "done" || pkg.actionStatus === "resolved") return false;
  // Grace period: "done" packages stay active briefly for smooth UX
  if (pkg.actionCompletedAt) {
    const elapsed = Date.now() - new Date(pkg.actionCompletedAt).getTime();
    if (elapsed < DONE_GRACE_MS) return true;
  }
  // 🤖 only matches "QA" (queued by automation), not "auto-ready" (spec waiting for queue)
  return /F[1-4]|🔨|⏸|🔧|🤖\s+QA|\b(IP|QA)\b/.test(pkg.phase);
}

/** Extract the leading numeric PKG id (e.g. "PKG-014" → 14) for sorting. */
function pkgNum(pkg: DevPackageEntry): number {
  const m = /^(\d+)/.exec(pkg.id.replace(/^PKG-/, ""));
  return m?.[1] ? Number.parseInt(m[1], 10) : 0;
}

export function isSpecPackage(pkg: DevPackageEntry): boolean {
  if (pkg.actionStatus) return false;
  return /F0|📋|auto-ready/.test(pkg.phase);
}

/**
 * Resolve the phase label to display, giving priority to the live
 * noema-actions.jsonl overlay over the static INDEX.md phase (PKG-055).
 */
export function resolveLivePhase(pkg: DevPackageEntry): string {
  switch (pkg.actionStatus) {
    case "processing":
      return "🔄 Feldolgozás alatt";
    case "pending":
      return "⏳ Sorban áll";
    case "failed":
      return "❌ Hiba";
    case "dead":
      return "💀 Végleg hibás";
    case "resolved":
      return "✅ Már kész";
    default:
      // Grace period: show "just completed" briefly
      if (pkg.actionCompletedAt) {
        const elapsed = Date.now() - new Date(pkg.actionCompletedAt).getTime();
        if (elapsed < DONE_GRACE_MS) return "✅ Frissen kész";
      }
      return pkg.phase;
  }
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
