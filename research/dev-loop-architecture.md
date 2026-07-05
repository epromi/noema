# Dev Loop Architecture

> 2026-07-05 | András kérése: semi-automatic fejlesztési loop, research-szel szinkronban

## Áttekintés

```
  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
  │   RESEARCH   │────▶│   APPROVAL   │────▶│  IMPLEMENT   │────▶│   VERIFY     │
  │   (auto)     │     │   (manual)   │     │  (semi-auto) │     │   (auto)     │
  └──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
         │                     │                     │                     │
   Research Cron          Dashboard             Alfred+Cursor         pnpm check
   (01:00 daily)        ▶ Mehet gomb          (orchestrator)         pnpm build
         │                     │                     │                     │
         ▼                     ▼                     ▼                     ▼
   proposals.jsonl      action-queue.jsonl      git commit            dashboard
   (structured)         (queued→done)          + push                regen
```

## Fázisok

### Fázis 1: RESEARCH (auto)
**Ki**: Research cron (`3b4ea5d3`, daily 01:00)
**Input**: `projects/noema/research-prompt.md` + competitive landscape + industry review
**Output**: `memory/research/noema/proposals.jsonl` — strukturált proposal-ok

Proposal formátum:
```json
{
  "id": "N-001",
  "timestamp": "2026-07-05T01:00:00Z",
  "source": "competitive-landscape|industry-review|self-review|roadmap",
  "type": "feature|fix|improvement|research",
  "title": "Rövid cím",
  "finding": "Mit talált a research",
  "suggested_pkg": "PKG-014-...",
  "priority": "P1|P2|P3",
  "effort": "S|M|L",
  "rationale": "Miért hasznos"
}
```

### Fázis 2: APPROVAL (manual)
**Ki**: András (dashboard gomb)
**Input**: Dashboard Research tab → proposal-ok listája
**Output**: `dashboard-actions.jsonl` → `type: "implement", status: "queued"`

Flow:
1. Dashboard mutatja a proposal-okat ▶ Mehet gombokkal
2. András rákattint → relay → JSONL queue
3. Processor (10p) → Alfred inbox

### Fázis 3: IMPLEMENT (semi-auto)
**Ki**: Alfred (orchestrator) + Cursor (executor)
**Input**: Proposal + auto-generated PKG spec
**Output**: Git commit + push

Döntési fa:
```
Proposal beérkezik
    │
    ├── Létezik PKG spec? ──Nem──▶ Alfred generál PKG spec-et
    │                                    │
    └── Igen ────────────────────────────┘
         │
         ▼
    Méret?
    ├── S (1-2 fájl) ──▶ Alfred implementálja közvetlenül
    ├── M (3-5 fájl) ──▶ Cursor agent --print --force
    └── L (6-10 fájl) ─▶ Cursor agent --mode plan → review → --force
         │
         ▼
    Alfred verifikál:
    ├── pnpm check ZÖLD?
    ├── pnpm build ZÖLD?
    ├── Fájlok jók? (read ellenőrzés)
    └── Git commit + push
         │
         ▼
    Mark "done" → dashboard regen
```

Cursor prompt template → `research/cursor-prompt-template.md`
(size-specific variants, model selection, verification checklist)

### Fázis 4: VERIFY (auto)
**Ki**: Alfred + CI
**Input**: Git push
**Output**: Dashboard regen + státusz update

1. GitHub CI: `pnpm check` + `pnpm build`
2. Alfred: dashboard regen
3. Action queue: `done` státusz
4. Dashboard frissül

## Loop Orchestrator Script

`scripts/dev-loop.sh` — a teljes loop vezérlése:

```bash
#!/usr/bin/env bash
# Usage: ./scripts/dev-loop.sh <pkg-id>
# Example: ./scripts/dev-loop.sh PKG-013

PKG_ID=$1
SPEC="dev/packages/$PKG_ID/spec.md"

# 1. Olvasd be a spec-et
# 2. Dönts: Cursor vagy Alfred?
# 3. Implementálj
# 4. Verifikálj
# 5. Commit + push
# 6. Dashboard regen
```

## Research Sync

A research cron (`3b4ea5d3`) prompt-ja kiegészül:

```
Output format: MINDEN találathoz generálj egy proposal JSON objektumot
ebben a formátumban:
{"id":"N-XXX","type":"feature","title":"...","finding":"...","priority":"P2","effort":"M"}

A proposal-okat a memory/research/noema/proposals.jsonl fájlba írd.
A dashboard template a generate.js-en keresztül olvassa ezt a fájlt.

Prioritás guide:
- P1: Blokkoló gap, azonnali (1 héten belül)
- P2: Fontos differentiator (2-4 hét)
- P3: Nice-to-have (1+ hónap)
```

## Státusz Követés

| Státusz | Jelentés |
|---------|----------|
| `proposed` | Research generálta |
| `queued` | András jóváhagyta (▶ Mehet) |
| `spec` | PKG spec generálva |
| `building` | Cursor/Alfred dolgozik |
| `verifying` | pnpm check/build folyamatban |
| `done` | Kész, merged, dashboard-on ✅ |
| `failed` | Vissza kell nézni |

## Current Implementation Status

- [x] Cursor CLI teszt: ✅ működik (`cursor agent --print --force --trust`)
- [x] Research cron: fut (01:00 daily)
- [x] Action queue: file-based (dashboard ↔ relay ↔ processor)
- [x] Dashboard gombok: ▶ Mehet működik
- [x] proposals.jsonl formátum: research-prompt.md frissítve
- [x] PKG spec auto-generálás: template kész (Alfred)
- [x] Cursor integration: prompt template + verifikáció checklist
- [x] Loop orchestrator: scripts/dev-loop.sh (6-phase)
- [ ] Dashboard regen auto-trigger: minden implementáció után
- [ ] Éles teszt: egy teljes PKG végig a loop-on
