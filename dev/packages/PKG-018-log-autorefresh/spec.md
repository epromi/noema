# PKG-018: Log Panel Auto-Refresh Fix

**Size:** S | **Effort:** 15min | **Priority:** P1 | **Status:** spec  
**Depends on:** PKG-014 (Log Viewer) ✅, PKG-016 (Dev Log Enhance) ✅ | **Spec date:** 2026-07-05

## 🎯 Mit

A dashboard log panel **nem frissül automatikusan** — a `viewLog()` függvény mindig megöli a 3 mp-es pollert a `stopLogPoll(pkgId)` hívással. Ezt a PKG-016 direkt így tervezte ("static log view for completed packages"), de a felhasználó szerint frissülnie kell.

### Javítandó

1. **`viewLog()`**: `stopLogPoll(pkgId)` sor törlése — ne ölje meg a pollert nyitáskor
2. **`toggleLog()`**: amikor egy LÉTEZŐ panelt újranyitunk (újra megjelenítjük):
   - Ha a poller már leállt → indítsa újra: `fetchLog()` + `setInterval(3000)`
   - Ha a poller még fut → ne csináljon semmit (már frissül)
3. **`stopLogPoll()`**: csak a panel bezárásakor hívódjon (`toggleLog` elrejtő ág)

## 📐 Scope

### Mit érint
- `archive/v4.html` — `viewLog()` + `toggleLog()` függvények (~5 sor változás)

### Mit NEM érint
- `relay.cjs` — semmi (endpoint jó)
- `generate.cjs` — semmi
- `src/lib/core/` — semmi

### Fázisok (S méret, 1 fájl)

| Fázis | Mit | Fájlok |
|-------|-----|--------|
| **Phase 1** | JS fix: `viewLog()` → ne öljön pollert, `toggleLog()` → indítson pollert újranyitáskor | `archive/v4.html` |
| **Phase 2** | Teszt: log panel nyit → poller fut, bezár → poller áll, újranyit → poller újraindul | Manuális böngésző teszt |

## ✅ Acceptance Criteria

1. Log gombra kattintva a panel megjelenik és 3 mp-enként frissül
2. Panel bezárásakor a poller leáll (nincs felesleges fetch)
3. Panel újranyitásakor a poller újraindul
4. Nincs memória leak (többszörös nyitás-zárás után is max 1 poller fut)
5. `bash -n` ✅
