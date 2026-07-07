# PKG-036: CPU Százalék a Rendszer Sorban 📊

**Státusz**: 📋 F0 | **Méret**: XS | **Becslés**: 15m | **Függőség**: PKG-032

## Kérés

A CPU a rendszer sorban (system bar) mutassa a százalékos kihasználtságot is, ugyanúgy ahogy a Disk mutatja: `Disk: 49% used (212G/460G)`.

Jelenleg a CPU sor így néz ki:
```
CPU: 1.23 0.87 0.67   Procs: 487
```

Kellene:
```
CPU: 31% (1.23 0.87 0.67)   Procs: 487
```

## Specifikáció

### 1. CpuWidget — Százalék Hozzáadása a Bar Módhoz

A `CpuWidget.svelte` `part="bar"` módjában a load average-ek mellett jelenjen meg a `cpuPercent`:

```svelte
{#if cpu && (part === "bar" || part === "both")}
  <span class="sys-item cpu-load {loadClass(cpu)}">
    CPU: {cpuPercent}% ({formatLoad(cpu)})
  </span>
  <span class="sys-item">Procs: {cpu.totalProcs}</span>
{/if}
```

A `cpuPercent` számítása:

```typescript
const cpuPercent = $derived(
  cpu
    ? Math.round((cpu.load1 / cpu.coreCount) * 100)
    : 0,
);
```

Ahol `load1 / coreCount * 100` = a load average aránya a magok számához viszonyítva. Pl. `load1 = 1.23`, `coreCount = 4` → `31%`.

### 2. Színkódolás

Ugyanaz a `loadClass(cpu)` színkódolás érvényes, ami már létezik:
- `ok` (zöld): load1 ≤ coreCount * 0.7
- `warn` (sárga): load1 > coreCount * 0.7 és ≤ coreCount
- `error` (piros): load1 > coreCount

A `cpuPercent` automatikusan az osztály szerinti színt kapja, mivel ugyanabban a `<span>`-ben van.

## Elfogadási Kritériumok

- [x] A rendszer sorban a CPU így jelenik meg: `CPU: 31% (1.23 0.87 0.67)`
- [x] A százalék színe követi a load level-t (zöld/sárga/piros)
- [x] A "Procs: N" változatlan marad
- [x] A `CpuWidget` list módja (Top CPU) változatlan
- [x] Tailscale-en keresztül is működik


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
