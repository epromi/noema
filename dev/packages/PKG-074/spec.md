# PKG-074: Dashboard Loading States

**Priority**: 🟡 Medium | **Size**: S | **Estimated**: 45m  
**Source**: QA 2026-07-20 Phase 1 — gap-components M22  
**Scope**: ✅ All files in `src/lib/components/`

## Problem

7 dashboard components jump directly from "no data" to "data" without any loading indicator. This causes a flash of empty content on first render.

Components: CronSidebar, Crons, CronTimeline, KanbanBoard, OttoTimeline, Overview, Viktor.

## Solution

Add `loading` prop + conditional `{#if loading}` wrapper with spinner + `role="status"` to each component.

## Status

⚠️ dev_loop auto-implement failed (subagent didn't execute, 0.0s — same issue as PKG-061 yesterday). Spec-only for now. Ready for Cursor manual implementation.
