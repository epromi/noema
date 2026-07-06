# PKG-033: Dev Package Log — Rendes Megjelenítés + Frissítés 🔧

**Státusz**: 📋 F0 | **Méret**: S | **Becslés**: 1h | **Függőség**: PKG-014, PKG-016, PKG-018, PKG-026

## Kérés

A dev package log rendesen mutassa a tartalmat és frissüljön. Jelenleg `⏳ Betöltés...` látszik folyamatosan, még akkor is ha van log fájl tartalommal.

## Root Cause

**Három egymásra épülő bug**:

### Bug 1: `findLogFile` csak `cursor-*` fájlokat keres

```typescript
// dev-loop-log.ts — jelenlegi
const match = files
  .filter((f) => f.startsWith(`cursor-${pkgId}`))
  .sort()
  .reverse()[0];
```

A log fájlok három típusa létezik:
- `cursor-PKG-031-package-clarity.log` → Cursor agent output (lehet 0 bájt)
- `dev-PKG-031-package-clarity.log` → Dev-loop wrapper log (mindig van tartalom)
- `review-PKG-031-package-clarity.log` → Review output

Ha a `cursor-*` fájl 0 bájtos, a `findLogFile` visszaadja → üres content → `⏳ Betöltés...`. Pedig a `dev-*` fájlban 669 bájt valódi tartalom van, de azt figyelmen kívül hagyja.

### Bug 2: Üres fájl → falsy content → placeholder felülírja

```svelte
<!-- LogPanel.svelte — jelenlegi -->
<pre>{content || "⏳ Betöltés..."}</pre>
```

Amikor a log fájl 0 bájt, `content = ""` → falsy → "⏳ Betöltés..." jelenik meg. Ez félrevezető — a log fájl létezik, csak üres. Helyesebb üzenet kéne.

### Bug 3: Nincs prioritási sorrend

Ha több log fájl is létezik ugyanahhoz a PKG-hoz, a `findLogFile` csak az első találatot adja vissza ABC sorrendben (nem tartalom/típus alapján).

## Specifikáció

### 1. `findLogFile` — Minden típus keresése, tartalom prioritással

```typescript
async function findLogFile(logDir: string, pkgId: string): Promise<string | null> {
  const files = await readdir(logDir);
  const candidates = files
    .filter((f) => f.endsWith(`-${pkgId}.log`) || f.includes(`${pkgId}`))
    .map((f) => join(logDir, f));

  // Prioritás: dev > review > cursor (dev mindig van tartalom)
  for (const prefix of ['dev', 'review', 'cursor']) {
    const match = candidates
      .filter((p) => basename(p).startsWith(`${prefix}-`))
      .sort()
      .reverse()[0];
    if (match) return match;
  }
  return null;
}
```

**Prioritási sorrend**: `dev-*` > `review-*` > `cursor-*`
- `dev-*` a dev-loop wrapper output-ja — mindig van benne valami
- `review-*` a review output
- `cursor-*` a Cursor agent közvetlen output-ja — gyakran üres az elején

### 2. `LogPanel` — Értelmes üres állapot

```svelte
<pre>
  {#if content}
    {content}
  {:else}
    📋 A log fájl létezik de még üres — a Cursor agent elkezdi írni amint elindul...
  {/if}
</pre>
```

VAGY: a `content` prop sose legyen üres string. Ha a fájl 0 bájt, a `getDevLoopLog` térjen vissza egy hasznos üzenettel:

```typescript
const raw = await readFile(logPath, "utf8");
const content = raw.length === 0 
  ? "📋 Várakozás Cursor kimenetre... (a fájl létezik de még üres)" 
  : raw.length > TAIL_BYTES ? raw.slice(-TAIL_BYTES) : raw;
```

### 3. Auto-refresh — Biztosítás hogy működjön

A `LOG_POLL_MS` ellenőrzése:
- Ha nincs definiálva → 3000ms legyen az alapértelmezett
- A `startLogPoll` azonnal fetch-eljen, ne csak az interval indulásakor
- A polling csak akkor álljon le ha a log panel be van csukva VAGY a komponens unmount-ol

### 4. `getDevLoopLog` — Robusztusabb hibakezelés

```typescript
export async function getDevLoopLog(pkgId: string): Promise<DevLoopLogData> {
  try {
    const logDir = join(workspaceRoot(), "projects", "noema", "logs");
    const logPath = await findLogFile(logDir, pkgId);

    if (!logPath) {
      return { 
        pkgId, 
        content: "⏳ Még nincs log fájl — a Cursor agent akkor hozza létre amikor elindul.\n(Ha a ▶ Mehet gombot már megnyomtad, várd meg amíg a dev-loop elindul.)",
        updatedAt: Date.now() 
      };
    }

    const raw = await readFile(logPath, "utf8");
    const content = raw.length === 0
      ? `📋 Üres log fájl (${basename(logPath)}) — várakozás Cursor kimenetre...`
      : raw.length > TAIL_BYTES ? raw.slice(-TAIL_BYTES) : raw;
    return { pkgId, content, updatedAt: Date.now() };
  } catch (err) {
    return {
      pkgId,
      content: `❌ Hiba a log olvasása közben: ${String(err)}`,
      updatedAt: Date.now(),
      error: String(err),
    };
  }
}
```

## Elfogadási Kritériumok

- [ ] `findLogFile` mindhárom típust keresi (cursor, dev, review), dev prioritással
- [ ] Ha a `cursor-*` fájl 0 bájt de a `dev-*` fájlban van tartalom → a `dev-*` tartalma jelenik meg
- [ ] Üres fájl esetén értelmes üzenet (nem `⏳ Betöltés...`)
- [ ] Még nem létező log fájl esetén értelmes placeholder
- [ ] Auto-refresh működik: 3 másodpercenként frissül amíg a panel nyitva van
- [ ] A log panel scroll aljára ugrik új tartalom esetén (meglévő feature, ne törjön)
- [ ] Tailscale-en keresztül is működik

### 5. Futó/Várakozó PKG — Ne legyen ▶ Mehet gomb

**Probléma**: Ha egy PKG már fut (`implementState = "running"`), a `DevPackageRow` továbbra is mutatja a ▶ Mehet gombot + 📋 Log gombot egyszerre. Az 5. sorban lévő PKG-nál ha a user rányom a ▶ Mehet gombra egy már futó package-nél, újraindítja a dev-loop-ot.

**Megoldás**: A `DevPackageRow` komponensben az `ImplementButton` helyett közvetlenül a 📋 Log gomb jelenjen meg, ha:
- `implementState === "done"` → ✅ kész jelzés (nincs gomb)
- `implementState === "running"` → CSAK 📋 Log gomb (a ▶ Mehet gomb ELTŰNIK)
- `implementState === "idle"` → ▶ Mehet gomb (a szokásos)

Az `ImplementButton` komponensben:

```svelte
{#if buttonState === "running"}
  <button class="log-btn" onclick={onLogToggle}>
    {logOpen ? "📋 Log ▲" : "📋 Log ▼"}
  </button>
{:else if buttonState === "done"}
  <span class="done-badge">✅</span>
{:else}
  <button class="implement-btn" onclick={onImplement}>▶ Mehet</button>
  {#if showLogButton}
    <button class="log-btn" onclick={onLogToggle}>
      {logOpen ? "📋 Log ▲" : "📋 Log ▼"}
    </button>
  {/if}
{/if}
```

**Elfogadási kritériumok**:
- [ ] Futó (`running`) PKG-nál nincs ▶ Mehet gomb, csak 📋 Log gomb
- [ ] Várakozó/sorban álló PKG-nál szintén nincs ▶ Mehet gomb (ha az állapot `running`-ként van tárolva)
- [ ] Idle PKG-nál ▶ Mehet gomb megjelenik (a megszokott módon)
- [ ] A 📋 Log gomb a futó PKG-nál ugyanúgy működik mint az idle-nél (open/close toggle, auto-refresh)

### 6. Sorba Állítás Státusz a Logban — Queue Visibility

**Probléma**: Amikor a user rányom a ▶ Mehet gombra, a Cursor agent nem azonnal indul — a dev-loop sorba állítja. Ezalatt a log panel `⏳ Betöltés...`-t mutat, ami azt a benyomást kelti hogy elromlott. A user nem tudja hogy a PKG sorban áll-e vagy sem.

**Megoldás**: A ▶ Mehet gomb megnyomásakor azonnal keletkezzen egy queue státusz, amit a log endpoint visszaad amíg nincs valódi log tartalom.

#### 6a. Queue Státusz Fájl

Amikor a `handleImplement` elküldi a kérést a relay-nek, **előtte** írjon egy queue státusz fájlt:

```typescript
// +page.svelte — handleImplement
async function handleImplement(pkgId: string, name: string) {
  setState(pkgId, { implementState: "running", showLogButton: true });

  // Azonnal írjunk queue státuszt hogy a log tudjon mit mutatni
  try {
    await fetch(`/api/log/${pkgId}/queue`, { method: "POST" });
  } catch { /* nem kritikus */ }

  // ... meglévő relay hívás
}
```

VAGY (egyszerűbb — külön API endpoint nélkül):

A `getDevLoopLog` ellenőrizze hogy van-e queue entry a relay-ben:

```typescript
// dev-loop-log.ts — getDevLoopLog
if (!logPath) {
  // Ellenőrizzük hogy a PKG sorban áll-e
  const queueStatus = await getQueueStatus(pkgId); // új függvény
  if (queueStatus) {
    return {
      pkgId,
      content: `⏳ Sorba állítva — ${queueStatus.message}\nBecsült kezdés: ${queueStatus.eta}`,
      updatedAt: Date.now(),
    };
  }
  return { pkgId, content: PLACEHOLDER, updatedAt: Date.now() };
}
```

#### 6b. Legegyszerűbb Implementáció — Queue Marker Fájl

A `handleImplement` írjon egy `queue-${pkgId}.json` fájlt a logs könyvtárba:

```json
{"pkgId":"PKG-031","queuedAt":"2026-07-06T18:05:00+02:00","estimatedMs":7200000}
```

A `getDevLoopLog` pedig:

```typescript
// Ha nincs log fájl, nézzük van-e queue marker
const queuePath = join(logDir, `queue-${pkgId}.json`);
try {
  const queueRaw = await readFile(queuePath, "utf8");
  const queue = JSON.parse(queueRaw);
  const elapsed = Date.now() - new Date(queue.queuedAt).getTime();
  const remaining = Math.max(0, queue.estimatedMs - elapsed);
  const remainingMin = Math.ceil(remaining / 60000);
  return {
    pkgId,
    content: `⏳ Sorba állítva…\n\nBecsült várakozás: ~${remainingMin} perc\n\nA Cursor agent akkor kezdi el amikor a dev-loop felszabadul.\nEz a log automatikusan frissül amint a Cursor elkezd írni.`,
    updatedAt: Date.now(),
  };
} catch {
  // nincs queue marker — a szokásos placeholder
}
```

Amint a Cursor agent létrehozza az első log fájlt (`cursor-*`), a `findLogFile` megtalálja és a valódi tartalmat adja vissza — a queue marker automatikusan ignorálva lesz.

**Queue marker takarítás**: A `cursor-*` vagy `dev-*` fájl létrejöttekor a queue marker törölhető (a `findLogFile` prioritása miatt amúgy sem használjuk ha van valódi log).

**Elfogadási kritériumok**:
- [ ] ▶ Mehet gomb megnyomása után a log azonnal mutatja: "⏳ Sorba állítva…" + becsült idő
- [ ] A becsült idő a PKG `estimatedMinutes` mezőjéből jön (INDEX.md-ből)
- [ ] Amint a Cursor agent elkezd írni, a valódi log tartalom automatikusan átveszi a helyét
- [ ] A queue marker fájl nem marad örökre — ha a log fájl létezik, a queue ignorálva van
- [ ] Az auto-refresh (3 mp) frissíti a becsült hátralévő időt
