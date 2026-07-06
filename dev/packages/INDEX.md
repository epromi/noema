# Noema 🧠 — Development Package Index

> Utolsó frissítés: 2026-07-06 18:07

## Aktív Csomagok

| PKG | Név | Fázis | Roadmap | Méret | Becsült idő | Függőség |
|-----|-----|-------|---------|-------|-------------|----------|
| PKG-001 | SvelteKit Scaffold | ✅ F5 | — | L | ✅ kész | — |
| PKG-013 | **Provider Abstraction Layer** 🧱 | ✅ F5 | F-23 P1 | M | ✅ kész | PKG-001 |
| PKG-014 | Dev Loop Log Viewer | ✅ F5 | F-05 P1 | S | ✅ kész | PKG-001 |
| PKG-015 | Expandable Package Rows | ✅ F5 | — | S | ✅ kész | PKG-001 |
| PKG-002 | Core: Cron Data | ✅ F5 | — | S | ✅ kész | PKG-013 |
| PKG-003 | Core: Agent Data | ✅ F5 | — | S | ✅ kész | PKG-013 |
| PKG-004 | Core: Health & Heartbeat | ✅ F5 | — | S | ✅ kész | PKG-013 |
| PKG-005 | Core: H1 Data | ✅ F5 | — | M | ✅ kész | PKG-013 |
| PKG-016 | Development Log Enhance | ✅ F5 | F-05 P1 | S | ✅ kész | PKG-001+014 |
| PKG-025 | Brainstorm + Bills + Research Tabs | ✅ F5 | — | M | ✅ kész | PKG-021 |
| PKG-024 | H1 + Viktor Tabs | ✅ F5 | — | M | ✅ kész | PKG-021 |
| PKG-023 | Orchestrator Tab | ✅ F5 | — | L | ✅ kész | PKG-021, PKG-022 |
| PKG-022 | Agents + Crons Tabs | ✅ F5 | — | M | ✅ kész | PKG-021 |
| PKG-021 | Data Pipeline + Overview Tab | ✅ F5 | — | L | ✅ kész | PKG-001..005 |
| PKG-020 | Action Queue — Több választási lehetőség | ✅ F5 | — | M | ✅ kész | — |
| PKG-019 | Cron Sidebar — Mindig látható oldalsáv | ✅ F5 | F-07 P1 | M | ✅ kész | PKG-001+017 |
| PKG-018 | Log Panel Auto-Refresh Fix | ✅ F5 | — | S | ✅ kész | PKG-014+016 |
| PKG-017 | Cron Timeline + Processor Timer | ✅ F5 | F-07 P1 | M | ✅ kész | PKG-001+002 |
| PKG-006 | Logs Viewer Tab | ✅ F5 | F-05 P1 | S | ✅ kész | PKG-001+002 |
| PKG-007 | Audit Trail | ✅ F5 | F-06 P1 | M | ✅ kész | PKG-001+003 |
| PKG-008 | Cron Health Timeline | 📋 F0 | F-07 P1 | S | 1h | PKG-001+002 |
| PKG-009 | SSE Live Updates | ✅ F5 | F-17↑ | M | ✅ kész | PKG-001+002+003 |
| PKG-010 | **Agent Decision Trace** | ✅ F5 | F-20 P2 | L | ✅ kész | PKG-001+003 |
| PKG-011 | Session Health Scoring | 📋 F0 | F-21 P2 | M | 2-3h | PKG-003 |
| PKG-012 | OTel Export (opcionális) | 📋 F0 | F-22 P3 | S | 1h | PKG-002..005 |
| PKG-026 | **Dev Job Floating Indicator** 🧩 | ✅ F5 | — | S | ✅ kész | PKG-021 |
| PKG-027 | **Nightly Dash Research → Dev Pipeline** 🤖 | 📋 F0 | — | S | 30m | PKG-013 |
| PKG-028 | **Tab Bar Overflow → More ▾** 📐 | 📋 F0 | — | M | 2h | PKG-001 |
| PKG-029 | **Dev Job Collapse Toggle** 🎛️ | 📋 F0 | — | S | 45m | PKG-026 |
| PKG-030 | **Log Menu Frissesség + Fordított Időrend** 🔄 | 📋 F0 | — | M | 1.5h | PKG-014, PKG-016 |
| PKG-031 | **Package List Áttekinthetőség** ⭐ | 📋 F0 | — | M | 2h | PKG-021 |
| PKG-032 | **Overview — CPU Terhelés + Top Process-ek** 📊 | 📋 F0 | — | S | 45m | PKG-004, PKG-021 |
| PKG-033 | **Dev Package Log — Rendes Megjelenítés + Frissítés** 🔧 | 📋 F0 | — | S | 45m | PKG-014, PKG-016, PKG-018, PKG-026 |

## Függőségi Sorrend

```
PKG-001 (scaffold)         ← ELSŐ
  ├── PKG-014 (log viewer) ← UI-only, bármikor
  ├── PKG-015 (expandable) ← UI-only, ✅ KÉSZ
  ├── PKG-016 (dev log)     ← UI enhancement
  └── PKG-013 (provider) 🧱 ← MÁSODIK (MINDEN core modul ezen keresztül megy)
        ├── PKG-002 (crons)
        │     ├── PKG-006 (logs viewer)
        │     ├── PKG-008 (cron timeline)
        │     ├── PKG-017 (cron timeline VIZUÁLIS) ← DASHBOARD-ONLY
        │     └── PKG-019 (cron sidebar) ← DASHBOARD LAYOUT
        ├── PKG-003 (agents)
        │     ├── PKG-007 (audit trail)
        │     └── PKG-010 (decision trace)
        │           └── PKG-011 (health scoring)
        ├── PKG-004 (health)
        │     └── PKG-032 (CPU load + top procs)
        ├── PKG-005 (H1 data)
        └── PKG-009 (SSE)       ← utolsó foundation
              └── PKG-012 (OTel)

AJÁNLOTT SORREND:
  1. PKG-001 → 2. PKG-016 → 3. PKG-013 🧱 → 4-7. PKG-002..005
  7. PKG-009 (SSE) → 8. PKG-014 → 9. PKG-006 → 10. PKG-008 → 11. PKG-007
  12. PKG-011 → 13. PKG-010 → 14. PKG-012 (low prio)

🚀 SVELTEKIT TAB-OK (amíg nincs teljes paritás):
  PKG-021 (Overview + pipeline) → PKG-022 (Agents + Crons) →
  PKG-023 (Orchestrator) → PKG-024 (H1 + Viktor) →
  PKG-025 (Brainstorm + Bills + Research)

🧩 KOMPONENSEK (globális widget-ek):
  PKG-026 (Dev Job Indicator) — draggable floating panel, minden tab-on
  PKG-029 (Collapse Toggle) — egysoros/kibővített váltó gomb a Dev Job panelen
  PKG-030 (Log Freshness) — auto-refresh + fordított időrend a log panelekben
  PKG-031 (Package Clarity) — fázis csoportok, keresés, progress bar, kompakt mód

✅ KÉSZ: PKG-001, PKG-013, PKG-014, PKG-015, PKG-002, PKG-003, PKG-004, PKG-005, PKG-016, PKG-021, PKG-022, PKG-023, PKG-024, PKG-025, PKG-026
⚠️  LEGACY-ONLY: PKG-017, PKG-019 (Cursor rossz target — dashboard.html helyett SvelteKit kell)
🔄 QUEUED: PKG-027 (Otto → Relay → Processor → Cursor bridge)
```

## Forrás Kulcs

| Forrás | Mit jelent |
|--------|------------|
| Industry Review 2026 | `research/industry-review-2026.md` — Braintrust, Zylos, DigitalApplied, dev.to |
| Architecture v2 | `architecture-v2.md` — SvelteKit migrációs terv |
| Roadmap | `roadmap.md` — 24 prioritizált feature |
| Competitive | `research/competitive-landscape.md` — 8 versenytárs elemzése |
| Adapter Pattern | `dev/packages/PKG-013-provider-abstraction/spec.md` — 6 provider interface |

## Státusz Kulcs

| Státusz | Jelentés |
|---------|----------|
| 📋 F0 | Specifikáció kész, fejlesztésre vár |
| 🔨 F1-F4 | Aktív fejlesztés alatt |
| ✅ F5 | Kész, merge-elve |
| ⏸️ | Blokkolt (függőség miatt) |
| ❌ | Elvetve |
