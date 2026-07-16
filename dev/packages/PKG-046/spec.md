# PKG-046: Billentyűparancsok + Gyors Navigáció ⌨️

**Státusz**: 📋 F0 | **Méret**: M | **Becslés**: 2-3h | **Függőség**: PKG-001
**Target**: SvelteKit
**Source**: QA External Benchmark (Competitive — Linear, Grafana, Vercel standard)

## Probléma

A Noema dashboard jelenleg csak egérrel navigálható. Modern eszközök (Linear ⌘K, Grafana gyorsbillentyűk, Vercel parancs-paletta) alapvető billentyűparancsokat és gyors keresést kínálnak → jelentősen gyorsítja a napi használatot power user-ek számára.

## Megoldás

Implementálni kell:
1. Globális billentyűparancsok (tab váltás, keresés, frissítés)
2. Parancs paletta (`⌘K` / `Ctrl+K`)
3. Fókusz management az egyes tab-okon belül

## Fájlok

| Fájl | Művelet |
|------|--------|
| `src/lib/components/shared/CommandPalette.svelte` | ÚJ — parancs paletta |
| `src/routes/+layout.svelte` | MÓDOSÍT — `onkeydown` handler + paletta |

## Specifikáció

### Billentyűparancsok

| Billentyű | Művelet |
|-----------|--------|
| `⌘K` / `Ctrl+K` | Parancs paletta megnyitása |
| `⌘1`..`⌘5` | Elsődleges tab-ok váltása (1-5) |
| `⌘6`..`⌘9` | Másodlagos tab-ok váltása (1-4) |
| `g o` | Go to Overview |
| `g a` | Go to Agents |
| `g c` | Go to Crons |
| `r` | Adatok frissítése (refresh) |
| `Escape` | Parancs paletta / panel bezárása |
| `?` | Billentyűparancsok segítség megjelenítése |

### Parancs Paletta

Komponens `CommandPalette.svelte`:
- Modal overlay, középre igazítva
- Input mező szűréssel (fuzzy match a tab nevekre + akciókra)
- Navigáció: ↑↓ nyilak + Enter kiválaszt
- Kategóriák: "Navigate", "Actions", "Views"
- Minden elemnél: label + shortcut badge + emoji

### Layout Integration

```svelte
<svelte:window onkeydown={handleKeydown} />

{#if commandPaletteOpen}
  <CommandPalette onClose={() => (commandPaletteOpen = false)} />
{/if}
```

```typescript
function handleKeydown(e: KeyboardEvent) {
  if ((e.metaKey || e.ctrlKey) && e.key === "k") {
    e.preventDefault();
    commandPaletteOpen = !commandPaletteOpen;
    return;
  }
  // number shortcuts for tab navigation
  if ((e.metaKey || e.ctrlKey) && /^[1-9]$/.test(e.key)) {
    e.preventDefault();
    const idx = parseInt(e.key) - 1;
    // map to tab IDs
  }
  // single-key shortcuts (only when no input focused)
  if (e.key === "?" && !(e.target instanceof HTMLInputElement)) {
    showShortcutsHelp = !showShortcutsHelp;
  }
}
```

### Shortcuts Help Modal

Kis információs panel `?` billentyűre:
- Táblázatos formátumban listázza az összes parancsot
- Escape / kattintás a modalon kívül → bezár

## Verifikáció

- [ ] pnpm check zöld
- [ ] pnpm test zöld
- [ ] pnpm build zöld
- [ ] ⌘K megnyitja/bezárja a parancs palettát
- [ ] ⌘1..⌘9 tab váltás
- [ ] Parancs palettában keresés és kiválasztás működik
- [ ] `?` segítség ablak
- [ ] Escape minden modalt bezár
