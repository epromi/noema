# PKG-056: Action Queue — Race Condition Fix

**Státusz**: 📋 F0 (specifikáció kész)  
**Méret**: XS  
**Becsült idő**: 15m  
**Függőség**: PKG-033 (Dev Package Log + Queue)  
**Dátum**: 2026-07-16

## Probléma

Az `action-processor.cjs` **elveszti a futása közben hozzáadott entry-ket**:

```
18:22:24 → processor beolvassa a JSONL-t (entries = [PKG-039, PKG-008])
18:22:24 → PKG-008 status=processing, writeEntries(entries)
18:29:38 → relay POST /action → PKG-054 hozzáadva a JSONL-hez ✅
18:30:47 → PKG-008 kész (502s), processor KIÍRJA a stale entries tömböt
            → PKG-054 eltűnik a JSONL-ből ❌
18:33:01 → processor fut, PKG-054 már nincs → "Nincs implementálható csomag"
```

**Root cause**: A processor a futás elején beolvasott `entries` tömböt mutálja és írja vissza a végén. A futás közben (8+ perc dev-loop alatt) a relay által hozzáadott új entry-k felülíródnak a régi tömbbel.

## Megoldás

`writeEntries` előtt **re-read + merge** a JSONL-ből:

```javascript
function writeEntriesSafe(entries, changedIds) {
  // Re-read current file to catch entries added by relay during this run
  const current = readEntries();
  const currentMap = new Map(current.map(e => [e.id, e]));

  // Merge: use our in-memory entry for IDs we touched, keep current for everything else
  for (const entry of entries) {
    currentMap.set(entry.id, entry);
  }

  const merged = [...currentMap.values()];
  fs.writeFileSync(ACTION_FILE, merged.map(e => JSON.stringify(e)).join('\n') + '\n', 'utf-8');
}
```

Alternatív (egyszerűbb): minden `writeEntries` hívás előtt re-read, és **csak a megváltozott entry-ket írjuk felül**:

```javascript
function writeEntries(entries) {
  // ⚡ Re-read to catch relay additions
  const current = readEntries();
  const merged = new Map(current.map(e => [e.id, e]));
  
  // Overlay our in-memory entries
  for (const e of entries) {
    merged.set(e.id, e);
  }
  
  const final = [...merged.values()];
  const tmp = ACTION_FILE + '.tmp.' + process.pid;
  fs.writeFileSync(tmp, final.map(e => JSON.stringify(e)).join('\n') + '\n', 'utf-8');
  fs.renameSync(tmp, ACTION_FILE);
}
```

A `readEntries` visszaad egy tömböt, a merge Map-pel biztosítja hogy:
1. A processor által módosított entry-k (`processing`→`done`, stb.) megmaradnak
2. A relay által közben hozzáadott új entry-k (`pending`) is megmaradnak
3. Azonos `id` esetén a processor verziója nyer (hiszen ő módosította)

## Érintett fájlok

| Fájl | Művelet |
|------|---------|
| `action-processor.cjs` | `writeEntries()` átírása: re-read + merge a meglévő írás előtt |

## Teszt

1. **Manuális**: Queue-olj be 2 PKG-t → a processor elkezdi az elsőt → közben queue-olj be egy harmadikat → a processor a futás végén ne törölje a harmadikat
2. **JSONL integritás**: A fájlban ne legyenek duplikált entry-k (id szerint)
3. **Relay**: `/next-trigger` továbbra is helyes `queueSize`-t adjon
