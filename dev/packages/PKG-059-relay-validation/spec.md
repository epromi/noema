# PKG-059: Relay Action Queue — Validáció + Queue Számolás Fix

**Státusz**: 📋 F0 (specifikáció kész)  
**Méret**: XS  
**Becsült idő**: 10m  
**Függőség**: PKG-054 (dev-packages.ts — ugyanaz a PKG, második fele)  
**Dátum**: 2026-07-16

## Probléma

PKG-054 3 spec követelményéből 2 kimaradt (csak a `dev-packages.ts` lett implementálva). Ez a PKG a hiányzó `relay.cjs` változásokat szállítja.

### 1. `/next-trigger` — fals queue count

A `queueSize` minden `pending`/`queued` entry-t számol, akkor is ha az action nem `implement` típusú (pl. `delegate`, `investigate`). A DevJobIndicator "2 sorban áll"-t mutatott régi meta action-ök miatt.

### 2. `POST /action` — nincs validáció

Bármilyen `action` típust elfogad (`delegate`, `investigate`, stb.), pedig az `otto-nightly-dashboard.md` protokoll szerint csak `"implement"` típus tartozik a dev pipeline queue-ba.

## Megoldás

### 1. `/next-trigger` — queueSize filter

```javascript
// JELENLEGI
queueSize: entries.filter(e => e.status === 'queued' || e.status === 'pending').length,

// ÚJ
queueSize: entries.filter(e => 
  (e.status === 'queued' || e.status === 'pending') && e.action === 'implement'
).length,
```

### 2. `POST /action` — validáció

```javascript
// A POST /action handler elejére:
const { action, id, description } = typeof body === 'string' 
  ? JSON.parse(body) 
  : body;

// 🆕 Validáció: csak "implement" action engedélyezett
if (action !== 'implement') {
  log('⛔', `${action} ${id}: rejected — non-implement action`);
  res.writeHead(400, { ...cors, 'Content-Type': 'application/json' });
  return res.end(JSON.stringify({ 
    ok: false, 
    error: `Action type "${action}" not allowed — only "implement" actions belong in the dev pipeline queue. Route non-implement items to Alfred inbox.` 
  }));
}

// ... existing code continues
```

## Érintett fájlok

| Fájl | Művelet |
|------|---------|
| `relay.cjs` | `/next-trigger` queue filter + `POST /action` validáció |

## Teszt

1. `POST /action` nem-`implement` típussal → 400, hibaüzenet
2. `POST /action` `implement` típussal → 200, `{"ok":true}`
3. `/next-trigger` → `queue` csak implement action-öket számol
4. `curl -s http://127.0.0.1:18998/next-trigger | grep queue` — 0 ha nincs implement queue-ban
