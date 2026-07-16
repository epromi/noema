# PKG-034: Package Row — Lenyitható Részletek 🔽

**Státusz**: 📋 F0 | **Méret**: S | **Becslés**: 30m | **Függőség**: PKG-015, PKG-021

## Kérés

A régi dashboardon a package lista elemre kattintva lenyílt a részletes leírása — a SvelteKit verzióban ez hiányzik. Vissza kell hozni.

## Jelenlegi Állapot

A `DevPackageRow` komponens egy sorban mutatja: `PKG-031 | név | 📋 F0 | [▶ Mehet]`. A sorra kattintva semmi nem történik. A log panel a 📋 Log gombra nyílik.

A régi v4 dashboard viszont `onclick="togglePkg('pkgrow-XXX')"`-et használt, ami lenyitott egy `pkg-detail` div-et a spec.md tartalmával.

## Specifikáció

### 1. DevPackageRow — Kattintható Sor

A `DevPackageRow` sorára kattintva lenyílik a részletes panel:

```svelte
<!-- DevPackageRow.svelte -->
<div class="pkg-row" class:done class:expanded={detailOpen}
     onclick={toggleDetail} onkeydown={(e) => e.key === 'Enter' && toggleDetail()}
     role="button" tabindex="0"
     aria-expanded={detailOpen}>
  <div class="pkg-main">
    <span class="pkg-chevron">{detailOpen ? '▾' : '▸'}</span>
    <span class="pkg-id">{pkgId}</span>
    <span class="pkg-name">{name}</span>
    <span class="pkg-phase">{phase}</span>
    <!-- gombok változatlanok -->
  </div>

  {#if detailOpen}
    <div class="pkg-detail" onclick={(e) => e.stopPropagation()}>
      <p class="detail-desc">{description}</p>
      {#if files}
        <div class="detail-files">
          <strong>📁 Fájlok:</strong> {files}
        </div>
      {/if}
      {#if phases}
        <div class="detail-phases">
          <strong>📋 Fázisok:</strong> {phases}
        </div>
      {/if}
    </div>
  {/if}

  <!-- LogPanel lent marad, független a detail-től -->
  <LogPanel open={logOpen} content={logContent} {pkgId} />
</div>
```

### 2. Adatforrás — Spec.md Parse-olás

A `getDevPackages()` bővítése: a PKG adatok mellé a spec.md tartalmából:
- `description`: a spec első bekezdése (a "## Kérés" vagy "## Jelenlegi Probléma" alatti első nem-üres sor)
- `files`: a "📁" sorok a spec-ből (fájl lista)
- `phases`: a "F0" / "F1" / "F5" említések

A `DevPackageEntry` type bővítése:

```typescript
export interface DevPackageEntry {
  id: string;
  name: string;
  phase: string;
  done: boolean;
  description?: string;   // 🆕
  files?: string;          // 🆕
  phases?: string;         // 🆕
}
```

### 3. Spec.md Olvasása

A `getDevPackages()` a `parsePackageIndex()` után minden PKG-hoz olvassa be a spec.md-t:

```typescript
async function readSpec(pkgId: string): Promise<Partial<DevPackageEntry>> {
  try {
    const specDir = join(workspaceRoot(), "projects", "noema", "dev", "packages");
    // Keresd meg a PKG könyvtárát (pl. PKG-031-package-clarity/)
    const dirs = await readdir(specDir);
    const pkgDir = dirs.find(d => d.startsWith(pkgId));
    if (!pkgDir) return {};
    
    const specPath = join(specDir, pkgDir, "spec.md");
    const spec = await readFile(specPath, "utf8");
    
    // Parse: első érdemi bekezdés a cím után
    const lines = spec.split('\n');
    let description = '';
    let files = '';
    let inFiles = false;
    
    for (const line of lines) {
      if (!description && line.match(/^[A-ZÁÉÍÓÖŐÚÜŰ].+/) && !line.startsWith('#')) {
        description = line.trim();
      }
      if (line.includes('📁')) {
        inFiles = true;
        files = line.trim();
      } else if (inFiles && line.trim()) {
        files += '\n' + line.trim();
      } else if (inFiles && !line.trim()) {
        inFiles = false;
      }
    }
    
    return { description, files };
  } catch {
    return {};
  }
}
```

### 4. Egyszerűsített Első Verzió

Ha a spec.md parse-olás túl komplex elsőre, használjunk egy egyszerűbb megközelítést:

Az INDEX.md-ben a PKG sor mellé egy rövid leírás oszlopot. VAGY: az `ImplementButton` komponens mellett egy `▸` chevron ami toggle-li a detail panelt, és a panel tartalma egy egyszerű API hívás ami visszaadja a spec.md tartalmát plain text-ben (a meglévő `/api/log/` mintára: `GET /api/spec/PKG-031`).

**Legegyszerűbb**: A `DevPackageRow` kapjon egy új `description` prop-ot, és a `+page.server.ts` load függvénye már SSR-ben olvassa be a spec-eket a `getDevPackages()`-en keresztül.

## Elfogadási Kritériumok

- [ ] A package sorokra kattintva lenyílik a részletes leírás (▸ → ▾)
- [ ] A leírás tartalmazza a spec.md rövid összefoglalóját
- [ ] A leírás tartalmazza az érintett fájlok listáját (ha van a spec-ben)
- [ ] A részletes panel NEM zavarja a Log panelt (külön toggle-elhetők)
- [ ] Újra kattintva a sorra a panel visszacsukódik
- [ ] A chevron (▸/▾) vizuálisan jelzi a nyitott/zárt állapotot
- [ ] Tailscale-en keresztül is működik
