# PKG-037: PKG Lista — Élő Frissítés Fájl Változásra 🔄

**Státusz**: 📋 F0 | **Méret**: S | **Becslés**: 30m | **Függőség**: PKG-031

## Kérés

Amikor új PKG kerül a listába (INDEX.md változik), a böngészőben azonnal frissüljön — **erőforrás-hatékonyan**, nem polling-gal.

## Jelenlegi Állapot

- A PKG lista SSR-ben töltődik be (`+page.server.ts` → `getDevPackages()`)
- A collector 60 másodpercenként gyűjti az adatokat és SSE-n broadcast-ol
- Új PKG hozzáadásakor a user-nek manuálisan kell frissítenie, vagy várni a következő collector ciklusra

## Specifikáció

### F1: File Watcher a Szerver Oldalon

Használjuk a Node.js `fs.watch`-et (inotify a Linux kernelben) az INDEX.md és a PKG könyvtárak figyelésére. Amikor változás történik, azonnal újragyűjtjük a noema adatokat és broadcast-oljuk SSE-n.

```typescript
// src/lib/server/pkg-watcher.ts (új fájl)
import { watch } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { collectOnce } from "./collector";

const WORKSPACE = process.env.WORKSPACE ?? join(homedir(), ".openclaw", "workspace");
const NOEMA_DIR = join(WORKSPACE, "projects", "noema");
const PKG_DIR = join(NOEMA_DIR, "dev", "packages");
const INDEX_FILE = join(PKG_DIR, "INDEX.md");

let watchers: Array<{ close: () => void }> = [];

export function startPkgWatcher(): void {
  // Debounce: több változás esetén csak egyszer frissítünk
  let timer: ReturnType<typeof setTimeout> | null = null;

  function onChange(event: string, filename: string | null) {
    // Csak a releváns fájlokat figyeljük
    if (filename && (
      filename === "INDEX.md" ||
      filename.endsWith(".md") ||
      filename.endsWith(".json")
    )) {
      if (timer) clearTimeout(timer);
      timer = setTimeout(async () => {
        console.log(`[pkg-watcher] ${filename} változott → frissítés`);
        try {
          await collectOnce();
        } catch (err) {
          console.error(`[pkg-watcher] hiba:`, err);
        }
      }, 500); // 500ms debounce
    }
  }

  try {
    // INDEX.md figyelése
    watchers.push(watch(INDEX_FILE, onChange));

    // PKG könyvtárak figyelése (új/meglévő spec-ek)
    watchers.push(watch(PKG_DIR, { recursive: false }, onChange));

    console.log(`[pkg-watcher] Figyelem: ${PKG_DIR}`);
  } catch (err) {
    console.error(`[pkg-watcher] Nem sikerült indítani:`, err);
  }
}

export function stopPkgWatcher(): void {
  for (const w of watchers) {
    w.close();
  }
  watchers = [];
}
```

### F2: Watcher Indítása a Szerver Indulásakor

```typescript
// src/hooks.server.ts — bővítés
import { startPkgWatcher } from "$lib/server/pkg-watcher";

// A meglévő hooks.server.ts-be:
if (typeof window === "undefined") {
  startPkgWatcher();
}
```

VAGY: az `index.js` belépési pontban (adapter-node build entry):

```typescript
// A build belépési pontján
import { startPkgWatcher } from "./chunks/pkg-watcher.js";
startPkgWatcher();
```

### F3: Debounce Mechanizmus

- 500ms debounce: ha több fájl változik egyszerre (pl. `generate.cjs` frissíti a dashboard.html-t + INDEX.md-t), csak egy `collectOnce()` hívás történik
- A `collectOnce()` már deduplikál (ha már fut egy gyűjtés, nem indít újat)
- Nincs rekurzív figyelés a PKG alkönyvtárakban — elég a `dev/packages/` szintet figyelni

### F4: Biztonság

Ha a `fs.watch` nem elérhető (nem támogatott platform), a watcher egyszerűen nem indul el — a collector 60 mp-es ciklusa változatlanul működik fallback-ként.

A watcher **soha nem blokkolja a fő szerver szálat** — minden fájl esemény aszinkron, a `collectOnce()` Promise alapú.

### F5: Kliens Oldali SSE — Már Létezik

A kliens oldali SSE hallgatózás már implementált (a `+page.svelte` vagy valamelyik komponensben). A `broadcast()` hívás után az összes kapcsolódott kliens megkapja a friss adatokat.

Ha még nincs SSE kliens a Noema/Dev tab-hoz:
- A `+page.svelte` `onMount`-jában csatlakozunk az `/api/sse` endpoint-ra
- Amikor új `noema` adat érkezik, frissítjük a `packages` store-t
- A Svelte reaktivitása automatikusan frissíti a UI-t

## Elfogadási Kritériumok

- [ ] Új PKG hozzáadása után a lista 1-2 másodpercen belül frissül a böngészőben
- [ ] Nincs polling — a `fs.watch` kernel szintű, nulla CPU idle állapotban
- [ ] 500ms debounce: több egyidejű változás esetén csak 1 gyűjtés
- [ ] A watcher hibája nem állítja le a szervert (try/catch)
- [ ] Fallback: ha a watcher nem indul, a 60 mp-es collector ciklus működik tovább
- [ ] Csak a noema adatok frissülnek — a többi dashboard adat nem változik feleslegesen
- [ ] Tailscale-en keresztül is működik (SSE a böngésző és a szerver között)


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
