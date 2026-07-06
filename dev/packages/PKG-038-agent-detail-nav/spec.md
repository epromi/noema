# PKG-038: Agent Detail + Navigáció Átalakítás 🧭

**Státusz**: 📋 F0 | **Méret**: M | **Becslés**: 1.5h | **Függőség**: PKG-021, PKG-022

## Kérés

1. **Menü átalakítás**: A subagentek (H1, Viktor, Brainstorm, Bills, Research, Logs, Audit, Trace) ne ugyanolyan menüpontok legyenek mint a fő tab-ok, hanem vizuálisan külön csoportban, de továbbra is közvetlenül elérhetőek
2. **Agent részletek oldal**: Overview agent tile → agent details, Agents sor → agent details, Crons agent oszlop → agent details — mindhárom helyről kattintással lehessen navigálni az agent részletes nézetére

## Jelenlegi Állapot

A `+layout.svelte`-ben egyetlen lapos `tab-bar` van 14 tab-bal, mind egyformán kinézve:

```
🏠 Overview | 🤖 Agents | ⏰ Crons | ⚡ Orchestrator | 🏴 HackerOne | 🛡️ Viktor | 🧠 Brainstorm | 🧠 Noema | 📋 Bills | 🔬 Research | 📋 Logs | 📜 Audit | 🌳 Trace
```

Kattintás az agent nevekre/tile-okra: **nincs** — csak statikus megjelenítés.

## Specifikáció

### F1: Kétszintű Navigációs Sáv

**Fő tab-ok** (elsődleges, teljes méret):
```
🏠 Overview | 🤖 Agents | ⏰ Crons | ⚡ Orchestrator | 🧠 Noema
```

**Subagent tab-ok** (kisebb, vizuálisan elkülönített sor):
```
🏴 H1 | 🛡️ Viktor | 🧠 Brainstorm | 📋 Bills | 🔬 Research | 📋 Logs | 📜 Audit | 🌳 Trace
```

A subagent sor:
- Kisebb betűméret (0.85em)
- Vékonyabb border-bottom
- Opcionálisan: halványabb háttér vagy más színű alsó border
- Bal oldalon `|` elválasztó vagy "Tools" címke

Layout a `+layout.svelte`-ben:

```svelte
<!-- Fő tab bar -->
<nav class="tab-bar tab-bar-primary" aria-label="Fő navigáció">
  {#each PRIMARY_TABS as tab}
    <button ...>{tab.label}</button>
  {/each}
</nav>

<!-- Subagent tab bar -->
<nav class="tab-bar tab-bar-secondary" aria-label="Eszközök">
  <span class="tab-label">Tools:</span>
  {#each SECONDARY_TABS as tab}
    <button ...>{tab.label}</button>
  {/each}
</nav>
```

### F2: Agent Detail Panel/Nézet

Amikor a user rákattint egy agent-re (Overview tile, Agents sor, vagy Crons agent oszlop), **betöltődik az agent részletes nézete**.

Két megközelítés — a **panel** egyszerűbb:

**Megközelítés A: Slide-in Panel (ajánlott, egyszerűbb)**

Egy jobbról becsúszó panel (mint a LogPanel), ami mutatja az agent adatait:

```svelte
<!-- AgentDetailPanel.svelte -->
{#if selectedAgent}
  <div class="agent-detail-panel" class:open>
    <button class="close-btn" onclick={close}>✕</button>
    <h2>{agent.emoji} {agent.name}</h2>
    <div class="agent-meta">
      <div>Status: <span class="status {agent.status}">{agent.statusText}</span></div>
      <div>Role: {agent.role}</div>
      <div>Last run: {agent.lastRun}</div>
      <div>Schedule: {agent.schedule}</div>
      {#if agent.extra}
        <div class="agent-extra">{@html agent.extra}</div>
      {/if}
    </div>
  </div>
{:else}
  <div class="agent-detail-panel empty">
    <p>Válassz egy agent-et a részletek megtekintéséhez</p>
  </div>
{/if}
```

**Megközelítés B: Dedikált Oldal (route: `/agent/[id]`)**

Egy `/agent/[id]` SvelteKit route, ami SSR-ben betölti az agent adatait. Ez komplexebb, de könyvjelzőzhető és mélylink-elhető.

**Választás**: F2-höz a **Panel** (A) megközelítés az egyszerűbb első implementáció. Később bővíthető route-ra.

### F3: Interakciós Pontok

#### Overview Agent Tile → Kattintás

```svelte
<!-- Overview.svelte — agent-card bővítés -->
<div class="agent-card" 
     onclick={() => selectAgent(agent.id)}
     onkeydown={(e) => e.key === 'Enter' && selectAgent(agent.id)}
     role="button" tabindex="0"
     class:clickable
>
  ...
</div>
```

A `selectAgent` egy context-en keresztül vagy props-on keresztül elérhető függvény, ami beállítja a `selectedAgentId` state-et.

#### Agents Tab → Sor Kattintás

```svelte
<!-- Agents.svelte — táblázat sor bővítés -->
<tr onclick={() => selectAgent(agent.id)}
    role="button" tabindex="0"
    class:clickable
>
  ...
</tr>
```

#### Crons Tab → Agent Oszlop Kattintás

```svelte
<!-- Crons.svelte — agent oszlop cella bővítés -->
<td class="col-agent">
  <button class="agent-link" onclick={() => selectAgent(cron.agentId)}>
    {cron.agentId}
  </button>
</td>
```

### F4: Agent Detail Panel — Tartalom

A panel az `agents/` könyvtárból olvasott adatokon felül mutassa:

| Mező | Forrás |
|------|--------|
| Emoji + Név | `AgentEntry` |
| Státusz (zöld/sárga/piros) | `AgentEntry.status` |
| Státusz szöveg | `AgentEntry.statusText` |
| Szerepkör | `AgentEntry.role` |
| Utolsó futás | `AgentEntry.lastRun` |
| Ütemezés | `AgentEntry.schedule` |
| Stale szint | `AgentEntry.staleLevel` |
| Extra HTML | `AgentEntry.extra` (pl. metric-ek Viktor-nál) |
| **Memória fájl** 🆕 | `AgentEntry.memory` — ha van status.md, annak tartalma |
| **Legutóbbi log-ok** 🆕 | `AgentEntry.recentLogs` — utolsó 3 log bejegyzés |

A memória és log adatok a `+page.server.ts` load-jában kerülnek kibővítésre az agent adatok mellé.

### F5: State Kezelés — Kontextus

A `selectedAgentId` a layout szintű state, context-ben megosztva:

```typescript
// +layout.svelte
let selectedAgentId = $state<string | null>(null);

setContext("noema-selected-agent", {
  get agentId() { return selectedAgentId; },
  selectAgent(id: string) { selectedAgentId = id; },
  closeAgent() { selectedAgentId = null; },
});
```

A `+page.svelte` olvassa a context-et és render-eli az `AgentDetailPanel`-t az oldal jobb oldalán.

## Elfogadási Kritériumok

- [ ] A navigációs sáv két sorra van bontva: fő tab-ok + subagent/tools tab-ok
- [ ] A subagent sor vizuálisan elkülönül (kisebb, halványabb, címkézett)
- [ ] Overview → agent tile kattintásra megnyílik a részletes panel
- [ ] Agents tab → sorra kattintva megnyílik a részletes panel
- [ ] Crons tab → agent oszlopban lévő névre kattintva megnyílik a részletes panel
- [ ] Az agent részletes panel mutatja: név, emoji, státusz, szerepkör, ütemezés, utolsó futás, extra adatok
- [ ] A panel becsukható (✕ gomb)
- [ ] Mobilon a panel teljes szélességben nyílik (ne a jobb oldalon)
- [ ] Tailscale-en keresztül is működik
