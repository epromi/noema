# PKG-035: Build Integrity Check — Soha Többé Sérült Build 🔒

**Státusz**: 📋 F0 | **Méret**: S | **Becslés**: 30m | **Függőség**: PKG-018, PKG-024

## Kérés

A PKG-031 esetében a `pnpm build` sikeresen lefutott, de a generált build **sérült volt** — a manifest egy olyan chunk-ra hivatkozott (`nodes/0.js-B7k3jrgl.js`) ami nem létezett. A dashboard 500 Internal Error-t adott, senki nem vette észre amíg András nem szólt.

Két ponton kell védekezni hogy ez soha többé ne forduljon elő.

## Root Cause

- A Vite build néha inkonzisztens manifest-et generál (race condition vagy partial write)
- A `pnpm build` exit code 0 volt — a build "sikeresnek" tűnt
- A Cursor dev-loop pipeline nem ellenőrizte a build integritását
- A service health endpoint nem detektálta hogy a dashboard 500-zik (csak a process él)

## Specifikáció

### F1: Post-Build Integrity Check Script

`scripts/verify-build.js` — a `pnpm build` után közvetlenül fut:

```javascript
#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const BUILD_DIR = path.join(__dirname, '..', 'build');
const MANIFEST = path.join(BUILD_DIR, 'server', 'chunks', 'manifest.js');
const ENTRY = path.join(BUILD_DIR, 'index.js');

let errors = [];

// 1. Manifest létezik?
if (!fs.existsSync(MANIFEST)) {
  errors.push('❌ server/chunks/manifest.js not found');
}

// 2. Entry point létezik?
if (!fs.existsSync(ENTRY)) {
  errors.push('❌ build/index.js not found');
}

// 3. Manifest-ben hivatkozott chunk-ok léteznek?
if (fs.existsSync(MANIFEST)) {
  const manifestContent = fs.readFileSync(MANIFEST, 'utf-8');
  // Vite SvelteKit manifest: import statements a chunks mappára
  const importPattern = /from\s+["']\.\/(.+?\.js-[A-Za-z0-9_]+\.js)["']/g;
  let match;
  while ((match = importPattern.exec(manifestContent)) !== null) {
    const chunkPath = path.join(path.dirname(MANIFEST), match[1]);
    if (!fs.existsSync(chunkPath)) {
      errors.push(`❌ Chunk missing: ${match[1]} (referenced in manifest)`);
    }
  }
}

// 4. Client build ellenőrzése
const clientDir = path.join(BUILD_DIR, 'client');
if (!fs.existsSync(clientDir)) {
  errors.push('❌ build/client/ not found');
}

// 5. Legalább egy .html létezik a client-ben
if (fs.existsSync(clientDir)) {
  const htmlFiles = fs.readdirSync(clientDir).filter(f => f.endsWith('.html'));
  if (htmlFiles.length === 0) {
    errors.push('❌ No HTML files in build/client/');
  }
}

if (errors.length > 0) {
  console.error('🚨 BUILD INTEGRITY CHECK FAILED:');
  errors.forEach(e => console.error('  ' + e));
  process.exit(1);
}

console.log('✅ Build integrity check passed');
process.exit(0);
```

### F2: package.json Build Script Frissítése

```json
{
  "scripts": {
    "build": "svelte-kit sync && vite build && node scripts/verify-build.js"
  }
}
```

A `vite build` akár 0 exit code-al is tud sérült build-et produkálni. A `node scripts/verify-build.js` garantálja hogy ha sérült, a pipeline elbukik (exit 1 → retry).

### F3: Service Health Endpoint — Server-Side Render Check

A `/api/health/ssr` endpoint ellenőrzi hogy a dashboard valóban render-el-e:

```typescript
// src/routes/api/health/ssr/+server.ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
  try {
    // Próbáljuk meg render-elni a főoldalt (SSR próba)
    const res = await fetch('http://localhost:8080/', {
      signal: AbortSignal.timeout(5000),
    });
    
    if (!res.ok) {
      return json({ ok: false, status: res.status, error: `SSR returned ${res.status}` }, { status: 500 });
    }
    
    const html = await res.text();
    if (html.length < 500) {
      return json({ ok: false, error: `SSR returned too little content (${html.length} bytes)` }, { status: 500 });
    }
    
    // Ellenőrizzük hogy van-e benne értelmes tartalom
    if (!html.includes('<!doctype html>') && !html.includes('<html')) {
      return json({ ok: false, error: 'SSR output does not look like HTML' }, { status: 500 });
    }
    
    return json({ ok: true, bytes: html.length });
  } catch (err) {
    return json({ ok: false, error: String(err) }, { status: 500 });
  }
};
```

### F4: Collector SSR Health Monitor

A collector 60 másodpercenként hívja az SSR health endpoint-ot. Ha 3 egymást követő ciklusban 500, akkor:

1. Logolja a hibát
2. A dashboard UI-ban piros banner jelenik meg: "🚨 Dashboard build sérült — újrabuild szükséges"
3. Opcionálisan: a `/api/health/ssr` hiba esetén a collector automatikusan trigger-el egy `pnpm build` + service restart-ot (csak ha az auto-fix engedélyezve van)

### F5: Dev-Loop Pipeline — Build Verification Step

A Cursor dev-loop pipeline `Phase 4: Cursor Agent` után:

```
Phase 4: Cursor Agent → kész
🔍 Phase 4b: Build Integrity → 
  pnpm build → node scripts/verify-build.js
  ✅ Build integrity OK
  VAGY
  ❌ Build integrity FAILED → auto-retry build (max 3x)
```

Ha 3 retry után is sérült a build:
1. A pipeline FAILED státuszba megy
2. A log tartalmazza a hiba részleteit
3. A PKG visszakerül "failed" státuszba az action queue-ban

## Elfogadási Kritériumok

- [ ] `pnpm build` exit code != 0 ha a build sérült (a verify-build.js miatt)
- [ ] A verify-build.js ellenőrzi: manifest létezik, chunk-ok léteznek, client build létezik, HTML fájlok léteznek
- [ ] `/api/health/ssr` endpoint létezik és visszaadja az SSR állapotot
- [ ] A collector 3 egymást követő 500 után alert-et küld
- [ ] A Cursor dev-loop pipeline build után futtatja a verify-build.js-t
- [ ] Soha többé nem fordul elő hogy sérült build kerül élesbe


## 🎯 Mit

_Placeholder — to be filled._


## 📐 Scope

_Placeholder — to be filled._


## Mit érint

_Placeholder — to be filled._


## Mit NEM érint

_Placeholder — to be filled._


## Fázisok

_Placeholder — to be filled._


## ✅ Acceptance Criteria

_Placeholder — to be filled._
