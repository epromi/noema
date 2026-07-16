# PKG-054: Package List Rendezés + Fejlesztés Alatti Lista + Action Queue Validáció

**Státusz**: 📋 F0 (specifikáció kész)  
**Méret**: S  
**Becsült idő**: 30m  
**Függőség**: PKG-031, PKG-033  
**Dátum**: 2026-07-16

## Probléma

1. **Nincs időrendi rendezés a package listákban**: A `groupPackages()` (`src/lib/core/dev-packages.ts`) csak szétválogat, nem rendez. András specifikációja:
   - "Spec kész" kategóriában a legrégebbi legfelül (ascending PKG#)
   - "Kész" kategóriában a legújabb legfelül, legrégebbi legalul (descending PKG#)

2. **"Fejlesztés alatt" lista üres**: `isActivePackage()` csak `F1-F4`, `🔨`, `⏸` fázisokat ismer fel. Az INDEX.md-ben PKG-047 (`🔧 IP`) és PKG-048 (`🤖 QA`) más jelölést használ → nem kerülnek az active listába. Továbbá, ha egy fázis nem ismert, a fallback `spec`-be dobja ahelyett hogy `active`-ként kezelné.

3. **Relay action queue számolás**: A `/next-trigger` endpoint minden `pending`/`queued` entry-t számol típustól függetlenül → nem-PKG action-ök (delegate, investigate) fals queue count-ot okoznak a DevJobIndicator-ban.

4. **Relay POST /action validáció hiánya**: Bármilyen `action` típust elfogad (`delegate`, `investigate`, stb.), pedig az `otto-nightly-dashboard.md` protokoll szerint csak `"implement"` típus tartozik ide. A nem-`implement` action-ök Alfred inbox-ba valók.

## Megoldás

### 1. dev-packages.ts — Rendezés + aktív fázis bővítés

```typescript
// Új helper
function pkgNum(pkg: DevPackageEntry): number {
  const m = /^(\d+)/.exec(pkg.id.replace(/^PKG-/, ""));
  return m?.[1] ? Number.parseInt(m[1], 10) : 0;
}

// isActivePackage — bővítés
export function isActivePackage(pkg: DevPackageEntry): boolean {
  return /F[1-4]|🔨|⏸|🔧|🤖|\b(IP|QA)\b/.test(pkg.phase);
}

// groupPackages — rendezés + unknown fallback → active
export function groupPackages(pkgs: DevPackageEntry[]): GroupedPackages {
  // ...
  // Unknown phase → treat as active
  } else {
    active.push(pkg);  // was: spec.push(pkg)
  }
  // Sort
  spec.sort((a, b) => pkgNum(a) - pkgNum(b));
  active.sort((a, b) => pkgNum(a) - pkgNum(b));
  done.sort((a, b) => pkgNum(b) - pkgNum(a));
  return { spec, active, done };
}
```

### 2. relay.cjs — Queue számolás filter

```javascript
// /next-trigger: csak implement action-öket számol
queueSize = entries.filter(e => 
  (e.status === 'queued' || e.status === 'pending') && e.action === 'implement'
).length;
```

### 3. relay.cjs — POST /action validáció

```javascript
// Csak "implement" action típus engedélyezett
if (action !== 'implement') {
  log('⛔', `${action} ${id}: rejected — non-implement action`);
  res.writeHead(400, { ...cors, 'Content-Type': 'application/json' });
  return res.end(JSON.stringify({ 
    ok: false, 
    error: `Action type "${action}" not allowed — only "implement" actions belong in the dev pipeline queue. Route non-implement items to Alfred inbox.` 
  }));
}
```

## Érintett fájlok

| Fájl | Művelet |
|------|---------|
| `src/lib/core/dev-packages.ts` | `pkgNum()` helper + `isActivePackage()` bővítés + `groupPackages()` rendezés + fallback fix |
| `relay.cjs` | `/next-trigger` queue filter + POST `/action` validáció |

## Teszt

1. `pnpm check` — 0 errors, 0 warnings
2. Ellenőrizd a Noema tab-on: "Specifikáció Kész" lista → PKG-008 legfelül, PKG-053 legalul
3. "Kész" lista → PKG-040 legfelül, PKG-001 legalul
4. "Fejlesztés alatt" lista → PKG-047, PKG-048 megjelenik
5. `POST /action` nem-`implement` típussal → 400, hibaüzenet
6. `GET /next-trigger` → `queue: 0` (nincs fals count)
