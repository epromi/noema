# PKG-045: Sötét/Világos Téma Váltás 🌗

**Státusz**: 📋 F0 | **Méret**: S | **Becslés**: 1h | **Függőség**: PKG-001
**Target**: SvelteKit
**Source**: QA External Benchmark (Table Stakes — minden modern dashboard tartalmazza)

## Probléma

A Noema dashboard jelenleg fix sötét témában jelenik meg. Modern dashboard-ok (Grafana, Linear, Vercel, Datadog) alapértelmezett funkciója a dark/light theme váltás. Hiánya csökkenti a felhasználói élményt, különösen nappali/nappali fényviszonyok között.

## Megoldás

Implementálni kell egy témaváltó gombot a layout fejlécében, CSS változók segítségével. A választott téma eltárolásra kerül localStorage-ban, és alkalmazás szinten elérhető minden komponens számára.

## Fájlok

| Fájl | Művelet |
|------|--------|
| `src/app.css` | MÓDOSÍT — light theme CSS változók hozzáadása |
| `src/routes/+layout.svelte` | MÓDOSÍT — témaváltó gomb |
| `src/lib/stores/theme.ts` | ÚJ — theme store (writable + localStorage) |

## Specifikáció

### CSS Változók

Light theme override-ok (`[data-theme="light"]`):
```css
[data-theme="light"] {
  --bg-primary: #f5f5f7;
  --bg-secondary: #ffffff;
  --bg-card: #ffffff;
  --text-primary: #1d1d1f;
  --text-secondary: #6e6e73;
  --border-color: #d2d2d7;
  --accent: #0071e3;
  --hover-bg: #e8e8ed;
  --shadow-sm: 0 1px 3px rgba(0,0,0,0.08);
}
```

### Témaváltó Gomb

A `+layout.svelte`-ben, a tab bar-ok mellett:
```svelte
<button
  type="button"
  class="theme-toggle"
  title="Téma váltás"
  onclick={() => toggleTheme()}
>
  {theme === "dark" ? "☀️" : "🌙"}
</button>
```

### Store

```typescript
// src/lib/stores/theme.ts
import { writable } from "svelte/store";

function createThemeStore() {
  const initial = typeof localStorage !== "undefined"
    ? (localStorage.getItem("noema-theme") as "dark" | "light") || "dark"
    : "dark";

  const { subscribe, set, update } = writable<"dark" | "light">(initial);

  return {
    subscribe,
    toggle: () => update(t => {
      const next = t === "dark" ? "light" : "dark";
      localStorage.setItem("noema-theme", next);
      document.documentElement.dataset.theme = next;
      return next;
    }),
    init: () => {
      if (typeof document !== "undefined") {
        document.documentElement.dataset.theme = initial;
      }
    }
  };
}

export const theme = createThemeStore();
```

### Viselkedés

1. Betöltéskor ellenőrizze a localStorage-t
2. Ha nincs mentett téma → dark (alapértelmezett)
3. Váltáskor: frissíti localStorage + `document.documentElement.dataset.theme`
4. Minden komponens CSS változókat használ → azonnali átállás

## Verifikáció

- [ ] pnpm check zöld
- [ ] pnpm test zöld
- [ ] pnpm build zöld
- [ ] Téma váltás működik oda-vissza
- [ ] Téma megmarad refresh után (localStorage)
- [ ] Light témában minden szöveg/ikon olvasható
