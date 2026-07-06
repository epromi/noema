# PKG-032: Overview — CPU Terhelés + Top Process-ek 📊

**Státusz**: 📋 F0 | **Méret**: S | **Becslés**: 45m | **Függőség**: PKG-004, PKG-021

## Kérés

Az Overview tab mutassa a processzor terhelést (load average) és a legtöbb CPU-t használó process-eket kompakt formában. Ha ugyanabból a processzből több példány fut, azok összesítve jelenjenek meg.

## Jelenlegi Probléma

Az Overview tab jelenleg csak uptime, disk, RAM hármast mutat a system bar-ban. CPU terhelés nincs. Amikor a gép load-ja magas (pl. 14.04 a mai OOM incidentnél), a dashboard nem jelzi — csak manuális `top`/`htop` paranccsal derül ki.

## Specifikáció

### 1. CPU Load a System Bar-ban

Az Overview tetején lévő `system-bar` bővítése:

```
pop-os | Uptime: 20h | Disk: 40% (32G/79G) | RAM: 10Gi/15Gi | CPU: 3.99 6.56 6.40 | Procs: 379
```

**Adatok**:
- `loadavg`: `/proc/loadavg` első három mezője (1, 5, 15 perces átlag)
- `procs`: futó processzek száma (`/proc/loadavg` 4. mező — running/total)

**Formázás**: 
- Ha load > magok száma → piros (`error` class)
- Ha load > magok × 0.7 → sárga (`warn`)
- Egyébként → zöld (`ok`)

### 2. Top CPU Process-ek — Kompakt Lista

A metrics kártyák alatt egy új kompakt szekció:

```
🔥 Top CPU
  firefox           45.5%  (1 proc)
  openclaw          31.1%  (2 procs)  ← összevonva!
  gnome-shell       27.3%  (1 proc)
  Web Content        4.5%  (3 procs)
```

**Adatgyűjtés**: `ps -eo comm,%cpu --no-headers | sort` → aggregálás process név szerint

**Aggregálási szabályok**:
- Ugyanolyan nevű processzek CPU%-a **összeadódik**
- Darabszám zárójelben: "(3 procs)"
- Csak azok jelenjenek meg amiknek az összesített CPU%-a > 1.0
- Maximum 8 sor
- A process neve max 20 karakter (csonkolás `…`-tel)

**Megjelenítés**:
- Kompakt: egy sor = process név + CPU% + darabszám
- CPU% oszlop jobbra igazítva
- A CPU% érték mögött egy vékony progress bar (a max CPU% arányában)
- A lista 60 másodpercenként frissül a collector ciklussal együtt

### 3. Adatforrás — Collector Bővítés

A `collector.ts` bővíteni kell egy `collectCpuData()` függvénnyel:

```typescript
async function collectCpuData(): Promise<CpuData> {
  // /proc/loadavg → load1, load5, load15, runningProcs
  // ps -eo comm,%cpu --no-headers → process lista
  // Aggregálás név szerint, szűrés >1%, rendezés csökkenő, top 8
}
```

**Provider út**: A Gateway REST API-n keresztül (`execCommand` → `gatewayApi` tool invoke). Az uptime, disk, RAM mintájára — de a `ps` parancsot is a `p.tool.execCommand` hívja (a provider proxy-n keresztül).

**VAGY** (egyszerűbb alternatíva): A `getHealth()`-ben közvetlenül a Node.js `fs.readFileSync('/proc/loadavg')` és `child_process.execSync('ps -eo comm,%cpu --no-headers')` használata, mivel ezek helyi fájlrendszer műveletek és nem igényelnek Gateway API-t.

### 4. Típusok Bővítése

```typescript
// types/index.ts
export interface CpuProcess {
  name: string;        // process név (pl. "firefox")
  cpuPercent: number;  // összesített CPU% (float, pl. 45.5)
  count: number;       // hány példány
}

export interface CpuData {
  load1: number;       // 1 perces load average
  load5: number;       // 5 perces 
  load15: number;      // 15 perces
  runningProcs: number; // futó processzek
  totalProcs: number;   // összes process
  topProcesses: CpuProcess[]; // top 8 aggregált
}
```

A `HealthData` interface bővül egy opcionális `cpu?: CpuData` mezővel.

### 5. UI Komponens

Új komponens: `src/lib/components/shared/CpuWidget.svelte`

- System bar rész: inline a meglévő `<span>`-ek között
- Top process lista: a metrics kártyák alatt, ugyanolyan kártya-stílusban
- A process lista kompakt — nem kell teljes táblázat, elég egy felsorolás

## Elfogadási Kritériumok

- [x] Load average (1/5/15) megjelenik az Overview system bar-ban
- [x] Load színkódolás: zöld (< magok), sárga (>70%), piros (>100%)
- [x] Top 8 CPU process megjelenik, folyamatnév szerint aggregálva
- [x] Azonos processzek összevont CPU%-a és darabszáma helyes
- [x] Csak >1% CPU használatú processzek jelennek meg
- [x] 60 másodpercenként frissül a collector ciklussal
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
