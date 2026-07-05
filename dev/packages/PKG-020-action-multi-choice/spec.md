# PKG-020: Action Queue — Több választási lehetőség

**Size:** M | **Effort:** 1.5-2h | **Priority:** P1 | **Status:** spec  
**Depends on:** PKG-001 (Scaffold) | **Spec date:** 2026-07-05

## 🎯 Mit

Az action queue jelenleg minden item-hez **egyetlen gombot** rendel (✅ Kész / 🔥 Eszkalál / ▶ Mehet). A valóságban egy item-re többféle döntés is lehet — pl. "Abandon / Keep / Escalate" vagy "Done / Skip / Delegate".

### F1: Multi-action adatmodell

Minden action queue item kap egy `actions` tömböt:

```json
{
  "id": "OL-004",
  "desc": "8x8 appeal: abandon or follow-up",
  "age": "50d",
  "severity": "red",
  "owner": "andras",
  "actions": [
    {"id": "abandon", "label": "🗑️ Abandon", "style": "danger"},
    {"id": "escalate", "label": "🔥 Escalate", "style": "warning"},
    {"id": "keep", "label": "📌 Keep", "style": "secondary"}
  ]
}
```

Ha egy item-nek nincs `actions` mezője, a meglévő single-action fallback érvényes.

### F2: UI — gombcsoport egy gomb helyett

```
┌──────────────────────────────────────────────────────────┐
│ 🔴 OL-004  8x8 appeal: abandon or follow-up?     50d    │
│  [🗑️ Abandon]  [🔥 Escalate]  [📌 Keep]                  │
├──────────────────────────────────────────────────────────┤
│ 🟡 Verify trial submissions for active programs         │
│  [✅ Done]  [⏭️ Skip]  [👔 Delegate to Viktor]           │
└──────────────────────────────────────────────────────────┘
```

- Gombok egy sorban, kis méretben
- Stílusok: `danger` (piros), `warning` (sárga), `secondary` (szürke), `primary` (zöld)
- Kattintás után a gombcsoport eltűnik, helyette visszajelzés: "✅ Abandon — done"
- Hover: tooltip a action ID-val

### F3: Action típusok bővítése

| Action | Jelentés | Feldolgozás |
|--------|----------|-------------|
| `done` | Kész / lezárva | Item status → done ✅ |
| `escalate` | Eszkalálás Albert-nek vagy más agent-nek | Spawn agent |
| `skip` | Kihagyás, nem csinálunk vele semmit | Item → skipped (archiválás 7 nap után) |
| `delegate` | Delegálás másik agent-nek | Item átkerül másik owner-hez |
| `keep` | Maradjon nyitva | Item → snooze 3 nap |
| `abandon` | Végleges bezárás indoklás nélkül | Item → closed |

### F4: Data source — hol definiáljuk a multi-action-öket?

1. **`memory/state/action-queue.md`**: a jelenlegi formátum bővítése
   ```markdown
   ### 🔴 Open Loops
   - [ ] **OL-004** (50d) 8x8 appeal follow-up → `[Abandon|Escalate|Keep]`
   ```
2. **`generate.cjs`**: parse-olja a `→ [option1|option2|...]` szintaxist, generálja a multi-action JSON-t
3. A régi single-action item-ek (csak `[ ]`) automatikusan `[✅ Done]`-t kapnak

### F5: Relay + processor frissítés

- Relay `POST /action`: új `actionId` mező (pl. `abandon`, `escalate`, `skip`)
- Processor: értelmezi az új action típusokat
- `abandon` → JSONL status `closed`
- `skip` → JSONL status `skipped`
- `delegate` → JSONL status `delegated`, új owner mező
- `keep` → JSONL status `snoozed`, snoozeUntil = now + 3d

## 📐 Scope

### Mit érint
- `archive/v4.html` — CSS: `.action-group`, `.action-btn`; JS: `renderActionButtons()` replace `actionBtn()`
- `generate.cjs` — action queue parse: `→ [option|option]` szintaxis → actions tömb
- `relay.cjs` — `POST /action`: fogadja az `actionId` mezőt
- `action-processor.cjs` — új action típusok kezelése
- `memory/state/action-queue.md` — példa item-ek multi-action szintaxissal

### Mit NEM érint
- `src/lib/core/` — semmi
- `scripts/dev-loop.sh` — semmi

### Fázisok

| Fázis | Mit | Fájlok |
|-------|-----|--------|
| **Phase 1** | Data model + parse: `generate.cjs` → `→ [A\|B\|C]` szintaxis → actions tömb | `generate.cjs` |
| **Phase 2** | UI: `.action-group` CSS + `renderActionButtons()` JS, gombcsoport render | `archive/v4.html` CSS+JS |
| **Phase 3** | Relay: `POST /action` actionId fogadás + továbbítás | `relay.cjs` |
| **Phase 4** | Processor: új action típusok (skip, delegate, abandon, keep) | `action-processor.cjs` |
| **Phase 5** | Adatforrás frissítés: action-queue.md multi-action példák | `memory/state/action-queue.md` |
| **Phase 6** | Teszt: minden action típus végig a pipeline-on, JSONL státuszok | Manuális + curl |

## 🎨 Design

### Gomb stílusok
```css
.action-btn { padding: 2px 8px; border-radius: 3px; font-size: 0.80em; font-weight: 600; border: none; cursor: pointer; white-space: nowrap; }
.action-btn.danger { background: var(--red); color: #fff; }
.action-btn.warning { background: var(--yellow); color: #000; }
.action-btn.secondary { background: var(--border); color: var(--text); }
.action-btn.primary { background: var(--green); color: #fff; }
.action-btn:hover { opacity: 0.85; transform: scale(1.03); }
.action-group { display: flex; gap: 6px; flex-shrink: 0; }
```

### Kanban board multi-action
```
┌──────────────────────────────────────────────┐
│ 👔 Alfred                          0 item    │
│  (üres)                                      │
├──────────────────────────────────────────────┤
│ 🧑 András                         3 item     │
│  🔴 OL-004  8x8 appeal...           50d     │
│    [🗑️ Abandon] [🔥 Escalate] [📌 Keep]     │
│  🟡 Verify trial submissions                 │
│    [✅ Done] [⏭️ Skip]                        │
│  🟡 Matomo OAuth2 audit                      │
│    [✅ Done] [👔 Delegate Viktor]            │
└──────────────────────────────────────────────┘
```

### Fallback single-action
Ha egy item-nek nincs explicit `→ [A|B]` szintaxisa:
```
🟡 Albert future decision    32d
  [✅ Done]
```

## ✅ Acceptance Criteria

1. Minden item-hez több gomb rendelhető a `→ [A|B|C]` szintaxissal
2. Régi single-action item-ek automatikusan `[✅ Done]`-t kapnak (visszafelé kompatibilis)
3. Mind a 6 action típus működik: done, escalate, skip, delegate, keep, abandon
4. Kattintás után a gombcsoport eltűnik, visszajelzés jelenik meg
5. Relay továbbítja az actionId-t a JSONL-be
6. Processor helyesen kezeli az új státuszokat (skipped, closed, delegated, snoozed)
7. `bash -n` ✅, `node -c` ✅, `pnpm check` ✅
