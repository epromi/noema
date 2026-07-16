# PKG-055: Dinamikus Package Állapot + Élő Frissítés

**Státusz**: 📋 F0 (specifikáció kész)  
**Méret**: M  
**Becsült idő**: 1.5h  
**Függőség**: PKG-021, PKG-033, PKG-054 (sorrend fix)  
**Dátum**: 2026-07-16

## Probléma

A Noema dashboard-on a package listák **statikusak** — az INDEX.md-ből olvasnak, ami manuálisan frissül és csak F0/F5 állapotokat tartalmaz. Az action queue (JSONL) valós idejű állapota (pending, processing, done) nem jelenik meg.

András elvárása:
- A lista **dinamikusan frissüljön** ahogy egy PKG végighalad a pipeline-on
- Minimum a Noema tab-on, de hosszabb távon más tab-okon is (Overview, Orchestrator)
- Egy PKG amint queue-ba kerül (pending) → "Fejlesztés alatt" listában jelenjen meg
- Processing közben → látható legyen hogy épp dolgozik rajta a dev-loop
- Amint kész → "Kész" listába kerüljön automatikusan

## Jelenlegi architektúra

```
INDEX.md               ← manuális, F0/F5, statikus
noema-actions.jsonl    ← valós idejű, pending/processing/done, dinamikus
       ↓                         ↓
getDevPackages()        getBuildIntegrity() / actionQueue()
       ↓                         ↓
Noema tab (statikus)    DevJobIndicator (dinamikus, de csak számol)
```

A két adatforrás **nincs összekapcsolva**. A Noema tab nem látja a JSONL állapotokat.

## Megoldás

### Phase 1: Adatfúzió — JSONL overlay INDEX.md-re (backend)

A `getDevPackages()` bővítése: INDEX.md parse után overlay a JSONL-ből:

```typescript
// Új: DevPackageEntry bővítése
interface DevPackageEntry {
  id: string;
  name: string;
  phase: string;        // INDEX.md static phase (📋 F0, ✅ F5, 🔧 IP)
  done: boolean;
  estimatedMinutes: number | null;
  // 🆕 JSONL overlay mezők
  actionStatus?: 'pending' | 'processing' | 'done' | 'failed' | 'dead' | null;
  actionQueuedAt?: string;
  actionCompletedAt?: string;
}

// Új: fázis számítás — INDEX.md + JSONL merge
function resolveLivePhase(pkg: DevPackageEntry): string {
  // Ha a JSONL szerint processing → 🔄
  if (pkg.actionStatus === 'processing') return '🔄 Feldolgozás alatt';
  // Ha pending (queue-ban van) → ⏳
  if (pkg.actionStatus === 'pending') return '⏳ Sorban áll';
  // Ha failed → ❌
  if (pkg.actionStatus === 'failed') return '❌ Hiba';
  // Ha dead → 💀
  if (pkg.actionStatus === 'dead') return '💀 Végleg hibás';
  // Különben INDEX.md szerinti statikus fázis
  return pkg.phase;
}
```

### Phase 2: Élő frissítés — polling a Noema tab-on (frontend)

```typescript
// Noema.svelte onMount-ban
const POLL_MS = 5000; // 5 másodpercenként frissít
onMount(() => {
  const timer = setInterval(async () => {
    const res = await fetch('/api/dev-packages');
    if (res.ok) packages = await res.json();
  }, POLL_MS);
  return () => clearInterval(timer);
});
```

Alternatíva: SSE (de a polling egyszerűbb és elég a Noema tab-ra)

### Phase 3: Vizuális jelzés

- **⏳ Sorban áll**: halvány sárga háttér, homokóra ikon
- **🔄 Feldolgozás alatt**: pulzáló kék háttér, spinner
- **❌ Hiba / 💀 Végleg hibás**: piros háttér
- **✅ Kész**: zöld pipa (meglévő)
- **📋 F0**: meglévő szürke

### Phase 4 (future): Több tab dinamikus frissítése

Az SSE már most is küld `crons`, `buildIntegrity`, `agents`, stb. adatokat. Ezek a tab-ok már most is frissülnek SSE-n keresztül. A Noema tab az egyetlen ami nem — mert a package lista nincs bent az SSE payload-ban.

Opcionális: `devPackages` hozzáadása az SSE payload-hoz (`getAllData()`-ban) → minden tab automatikusan frissül.

## Érintett fájlok

| Fájl | Művelet |
|------|---------|
| `src/lib/types/index.ts` | `DevPackageEntry` bővítés: `actionStatus`, `actionQueuedAt`, `actionCompletedAt` |
| `src/lib/core/dev-packages.ts` | `getDevPackages()`: JSONL overlay + `resolveLivePhase()` |
| `src/lib/core/dev-loop-log.ts` | `getDevPackages()`: JSONL beolvasás itt történik (node fs) |
| `src/lib/components/tabs/Noema.svelte` | Polling timer + live phase UI (háttérszínek, ikonok) |
| `src/routes/api/dev-packages/+server.ts` | 🆕 Új API endpoint: GET → JSONL+INDEX.md merged data |

## Teszt

1. Noema tab megnyitása → látjuk a PKG listákat
2. PKG-054 pending → "⏳ Sorban áll" megjelenik a "Fejlesztés alatt" listában
3. Amikor az action-processor elindítja → "🔄 Feldolgozás alatt"
4. Amikor kész → automatikusan átkerül a "✅ Kész" listába
5. 5 másodpercen belül frissül a nézet polling nélkül is (a timer fut)

## Alternatíva (elvetve)

- **SSE**: komplexebb, de egységes a többi tab-bal. A polling egyszerűbb és a Noema tab amúgy is csak akkor aktív amikor rákattintanak. Phase 4-ben lehet átállni SSE-re.
- **WebSocket**: túlzó, nincs szükség bidirectional kapcsolatra
