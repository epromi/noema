# Noema 🧠 — Development Package Index

> Utolsó frissítés: 2026-07-05 10:50

## Aktív Csomagok

| PKG | Név | Fázis | Roadmap | Méret | Becsült idő | Függőség |
|-----|-----|-------|---------|-------|-------------|----------|
| PKG-001 | SvelteKit Scaffold | 📋 F0 | — | L | 1.5-2h | — |
| PKG-002 | Core: Cron Data | 📋 F0 | — | S | 0.5-1h | PKG-001 |
| PKG-003 | Core: Agent Data | 📋 F0 | — | S | 0.5-1h | PKG-002 |
| PKG-004 | Core: Health & Heartbeat | 📋 F0 | — | S | 0.5h | PKG-003 |
| PKG-005 | Core: H1 Data | 📋 F0 | — | M | 1-1.5h | PKG-002 |
| PKG-006 | Logs Viewer Tab | 📋 F0 | F-05 P1 | S | 1h | PKG-001+002 |
| PKG-007 | Audit Trail | 📋 F0 | F-06 P1 | M | 1.5-2h | PKG-001+003 |
| PKG-008 | Cron Health Timeline | 📋 F0 | F-07 P1 | S | 1h | PKG-001+002 |
| PKG-009 | SSE Live Updates | 📋 F0 | F-17↑ | M | 1.5-2h | PKG-001+002+003 |
| PKG-010 | **Reasoning Trace Viewer** 🔥 | 📋 F0 | F-20 P1 | L | 3-4h | PKG-001+003 |
| PKG-011 | Eval Scoring Engine | 📋 F0 | F-21 P2 | L | 3-4h | PKG-010 |
| PKG-012 | OTel GenAI Export | 📋 F0 | F-22 P2 | M | 1.5-2h | PKG-002..005 |

## Függőségi Sorrend

```
PKG-001 (scaffold)         ← ELSŐ
  ├── PKG-002 (crons)
  │     ├── PKG-006 (logs viewer)
  │     └── PKG-008 (cron timeline)
  ├── PKG-003 (agents)
  │     ├── PKG-007 (audit trail)
  │     └── PKG-010 (reasoning trace) 🔥
  │           └── PKG-011 (eval engine)
  ├── PKG-004 (health)
  ├── PKG-005 (H1 data)
  └── PKG-009 (SSE)       ← utolsó foundation
        ├── PKG-012 (OTel export)

AJÁNLOTT SORREND:
  1. PKG-001 → 2. PKG-002 → 3. PKG-003 → 4. PKG-004 → 5. PKG-005
  6. PKG-009 (SSE) → 7. PKG-006 → 8. PKG-008 → 9. PKG-007
  10. PKG-010 🔥 → 11. PKG-011 → 12. PKG-012
```

## Forrás Kulcs

| Forrás | Mit jelent |
|--------|------------|
| Industry Review 2026 | `research/industry-review-2026.md` — Braintrust, Zylos, DigitalApplied, dev.to |
| Architecture v2 | `architecture-v2.md` — SvelteKit migrációs terv |
| Roadmap | `roadmap.md` — 24 prioritizált feature |
| Competitive | `research/competitive-landscape.md` — 8 versenytárs elemzése |

## Státusz Kulcs

| Státusz | Jelentés |
|---------|----------|
| 📋 F0 | Specifikáció kész, fejlesztésre vár |
| 🔨 F1-F4 | Aktív fejlesztés alatt |
| ✅ F5 | Kész, merge-elve |
| ⏸️ | Blokkolt (függőség miatt) |
| ❌ | Elvetve |
