# PKG-060: Failed/Dead Packages — Hibás Lista a Noema Tab-on

**Státusz**: 📋 F0 (specifikáció kész)  
**Méret**: S  
**Becsült idő**: 30m  
**Függőség**: PKG-056 (race fix — hogy a hibás entry-k ne vesszenek el), PKG-055 (dinamikus package állapot overlay)  
**Dátum**: 2026-07-16

## Probléma

A Noema tab jelenleg 3 szekciót mutat: **Fejlesztés alatt**, **Spec kész**, **Kész**. Hiányzik egy negyedik: **Hibás** — azok a csomagok amiknek az action queue entry-je `dead` vagy `failed` státuszú. Most ezek láthatatlanok a dashboard-on, ami azt eredményezi hogy senki nem tud róluk amíg manuálisan nem ellenőrzi a JSONL-t.

Példa: PKG-039 2026-07-06 óta `dead` a queue-ban de a dashboard ✅ F5-öt mutat — egymásnak ellentmondó információ. PKG-057 és PKG-055 most buktak el.

## Megoldás

### Új szekció: "⚠️ Hibás"

- Pozíció: **Spec kész felett** (legyen szembetűnő)
- Benne: `dead` és `failed` action queue entry-k
- Minden sor:
  - PKG id + név
  - Státusz ikon: 💀 (dead) / ❌ (failed)
  - Retry számláló: "2/3 próbálkozás"
  - Hibaüzenet első sora (truncated 80 char)
  - "Részletek" lenyitás → full error log

### Adatforrás

A JSONL action queue-ból (`memory/state/noema-actions.jsonl`), a PKG-055 overlay-hez hasonlóan:

```typescript
// Új típus
interface ActionQueueEntry {
  id: string;
  action: string;
  status: 'queued' | 'pending' | 'processing' | 'done' | 'failed' | 'dead';
  retries?: number;
  lastError?: string;
  ts: string;
  updatedAt?: string;
}

// Új függvény dev-packages.ts-ben
export function getFailedPackages(
  pkgs: DevPackageEntry[], 
  queue: ActionQueueEntry[]
): FailedPackage[] {
  const deadOrFailed = queue.filter(e => 
    e.status === 'dead' || e.status === 'failed'
  );
  
  return deadOrFailed.map(e => {
    const pkg = pkgs.find(p => p.id === e.id);
    return {
      id: e.id,
      name: pkg?.name ?? '(ismeretlen)',
      status: e.status,
      retries: e.retries ?? 0,
      maxRetries: 3,
      error: e.lastError ?? '(nincs hibaüzenet)',
      phase: pkg?.phase ?? '?',
      updatedAt: e.updatedAt ?? e.ts,
    };
  });
}
```

### UI: DevPackageFailed.svelte

```svelte
<!-- Új komponens -->
<div class="failed-section">
  <h3>⚠️ Hibás ({count})</h3>
  {#each packages as pkg}
    <div class="failed-row" class:dead={pkg.status === 'dead'}>
      <span class="icon">{pkg.status === 'dead' ? '💀' : '❌'}</span>
      <span class="id">{pkg.id}</span>
      <span class="name">{pkg.name}</span>
      <span class="retries">{pkg.retries}/{pkg.maxRetries}</span>
      <span class="error">{truncate(pkg.error, 80)}</span>
      <button on:click={() => showDetails(pkg.id)}>Részletek</button>
    </div>
    {#if expanded[pkg.id]}
      <div class="error-detail">
        <pre>{pkg.error}</pre>
      </div>
    {/if}
  {/each}
</div>
```

### CSS

```
⚠️ Hibás — piros/figyelmeztető szín, feltűnőbb mint a sima szekciók
💀 dead — sötétpiros háttér
❌ failed — narancssárga háttér
```

## Érintett fájlok

| Fájl | Művelet |
|------|---------|
| `src/lib/core/dev-packages.ts` | `getFailedPackages()` + `FailedPackage` típus |
| `src/lib/components/shared/DevPackageFailed.svelte` | Új komponens |
| `src/lib/components/tabs/Noema.svelte` | Failed szekció beillesztése Spec kész fölé |
| `src/lib/types/index.ts` | `ActionQueueEntry` + `FailedPackage` típusok |
| `tests/core/dev-packages.test.ts` | `getFailedPackages()` tesztek |

## Teszt

1. Üres queue → "⚠️ Hibás" szekció nem jelenik meg
2. 1 dead + 1 failed → mindkettő látszik, megfelelő ikonnal
3. Részletek lenyitás → full error log látható
4. `pnpm check` 0e 0w
