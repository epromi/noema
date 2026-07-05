# PKG-007: Audit Trail / Activity Feed (F-06)

> Státusz: 📋 Spec kész | Méret: M | Roadmap: F-06 P1

## Spec

**Mit**: `lib/core/audit-trail.ts` + `AuditTrail.svelte` — kronologikus timeline minden rendszereseményről (session start, agent spawn, cron trigger, error, action event).

**F0**: spec | **F1**: audit-trail.ts (sessions_list + cron history → unified timeline, session filter) | **F2**: AuditTrail.svelte (timeline vizualizáció, filter) | **F3**: collector + index | **F4**: test + build | **F5**: merge
