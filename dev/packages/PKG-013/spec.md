# PKG-013: Provider Abstraction Layer

> Státusz: 📋 Spec kész | Méret: M | Roadmap: F-23 P1
> Cél: OpenClaw API hívások izolálása adapter réteg mögé
> Forrás: András kérése 2026-07-05 — "ne legyen szenvedős az átírás ha OpenClaw-ról átállnánk"

## Probléma

Jelenleg a `lib/core/*.ts` modulok KÖZVETLENÜL hívják az OpenClaw API-kat:

```typescript
// lib/core/crons.ts
const crons = await exec("openclaw cron list --json")
const session = await sessions_history(sessionKey)
const inbox = await exec("openclaw gateway tools/invoke", { body: {...} })
```

Ha OpenClaw-t cserélünk: ~9 core modul, ~70% újraírandó.

## Megoldás: Provider Pattern

```
lib/core/crons.ts → provider.getCrons()
                        ↓
lib/providers/
├── types.ts          ← interface definíciók
├── openclaw.ts       ← jelenlegi implementáció
└── (new-framework.ts) ← jövőbeni implementáció
```

Core modulok SOHA nem hívnak OpenClaw API-t közvetlenül. Csak a provider interface-t.

## Provider Interfacek

### 1. CronProvider
```typescript
interface CronProvider {
  listCrons(): Promise<CronJob[]>           // openclaw cron list --json
  runCron(jobId: string): Promise<void>     // openclaw cron run --jobId
  getCronStatus(): Promise<CronStatus>      // openclaw cron status
  getCronRuns(jobId: string): Promise<CronRun[]>
}
```

### 2. SessionProvider
```typescript
interface SessionProvider {
  listSessions(filter?: SessionFilter): Promise<Session[]>
  getHistory(sessionKey: string): Promise<Message[]>
  spawnAgent(agentId: string, task: string): Promise<SpawnResult>
}
```

### 3. AgentProvider
```typescript
interface AgentProvider {
  listSubagents(): Promise<Subagent[]>
  steerSubagent(target: string, message: string): Promise<void>
  killSubagent(target: string): Promise<void>
}
```

### 4. MessagingProvider
```typescript
interface MessagingProvider {
  sendMessage(channel: string, target: string, text: string): Promise<void>
  sessionsSend(sessionKey: string, message: string): Promise<void>
}
```

### 5. FilesystemProvider
```typescript
interface FilesystemProvider {
  readMemory(path: string): Promise<string>        // memory/... elérés
  writeMemory(path: string, content: string): Promise<void>
  readAgentStatus(agentId: string): Promise<AgentStatus>
  readState(path: string): Promise<string>          // memory/state/...
  readResearch(path: string): Promise<string>       // memory/research/...
}
```

### 6. ToolProvider (opcionális — külső CLI tool-ok)
```typescript
interface ToolProvider {
  h1Command(cmd: string): Promise<string>           // scripts/h1.sh
  gogCommand(cmd: string): Promise<string>          // gog CLI
  execCommand(cmd: string): Promise<string>         // generic shell
}
```

## Scope

| Modul | Jelenleg hív | Provider interface | Bonyolultság |
|-------|-------------|-------------------|-------------|
| `crons.ts` | `cron list/run/status` | CronProvider | Alacsony |
| `agents.ts` | `sessions_list/history/spawn` | SessionProvider + AgentProvider | Közepes |
| `health.ts` | `gateway status` + filesystem | FilesystemProvider | Alacsony |
| `noema.ts` | `memory/state/` | FilesystemProvider | Alacsony |
| `h1.ts` | `scripts/h1.sh` | ToolProvider | Alacsony |
| `calendar.ts` | `gog` CLI | ToolProvider | Alacsony |
| `research.ts` | `memory/research/` | FilesystemProvider | Alacsony |
| `bills.ts` | `memory/logistics/` | FilesystemProvider | Alacsony |

## Fázisok

### F0 — Interface Design (~20 perc)
- [ ] Minden provider interface véglegesítése
- [ ] Átfedések azonosítása (pl. SessionProvider vs AgentProvider)
- [ ] Meglévő core modulok API hívás-listája (minden exec/sessions_*)

### F1 — Interface Defs (~30 perc)
- [ ] `lib/providers/types.ts`: mind a 6 interface + shared típusok
- [ ] `pnpm check` ZÖLD (csak típusdefiníciók, nincs implementáció)

### F2 — OpenClaw Adapter (~60 perc)
- [ ] `lib/providers/openclaw.ts`: mind a 6 interface implementálása
  - CronProvider → `exec("openclaw cron list --json")`
  - SessionProvider → `sessions_list()`, `sessions_history()`, `sessions_spawn()`
  - AgentProvider → `subagents()`
  - MessagingProvider → `message.send()`, `sessions_send()`
  - FilesystemProvider → `read()`, `write()` (memory elérési utak konfigurálhatóvá)
  - ToolProvider → `exec()`
- [ ] `lib/providers/openclaw-singleton.ts`: egyetlen provider instance export

### F3 — Core Refaktor (~90 perc)
- [ ] `lib/core/crons.ts`: `exec("openclaw cron list")` → `provider.listCrons()`
- [ ] `lib/core/agents.ts`: `sessions_list()` → `provider.listSessions()`
- [ ] `lib/core/health.ts`: fájl olvasások → `provider.readMemory()`
- [ ] `lib/core/noema.ts`: fájl olvasások → `provider.readState()`
- [ ] `lib/core/h1.ts`: `exec("scripts/h1.sh")` → `provider.h1Command()`
- [ ] `lib/core/calendar.ts`: `exec("gog")` → `provider.gogCommand()`
- [ ] `lib/core/research.ts`: fájl olvasások → `provider.readResearch()`
- [ ] `lib/core/bills.ts`: fájl olvasások → `provider.readMemory()`
- [ ] Minden core modul EGYSZERRE refaktorálva (nem inkrementálisan — típushibák elkerülése)
- [ ] `pnpm check` ZÖLD

### F4 — Provider Factory (~15 perc)
- [ ] Környezeti változó: `NOEMA_PROVIDER=openclaw` (default)
- [ ] `lib/providers/index.ts`: `getProvider(): AllProviders` — factory
- [ ] Ha `NOEMA_PROVIDER=openclaw` → `openclaw-singleton`
- [ ] Ha `NOEMA_PROVIDER=<other>` → future adapter

### F5 — Merge (~10 perc)
- [ ] Git commit: "🧱 feat: Provider Abstraction Layer (F-23, PKG-013)"
- [ ] Dokumentáció: `architecture-v2.md` frissítése (provider réteg hozzáadása)

## Érvelés: Miért MOST csináljuk?

1. **Még kicsi a codebase** (11 core modul, becsült ~500 sor). Később 2-3× ennyi lenne.
2. **PKG-001..005 után azonnal** — amint a core modulok megvannak, azonnal adapter mögé
3. **OpenClaw API stability** — az `openclaw` CLI interface változhat, a provider izolálja ezt
4. **Tesztelhetőség** — mock provider-rel a core modulok tesztelhetők OpenClaw nélkül

## Hatás

| Amikor | Mit kell csinálni | Effort |
|--------|-------------------|--------|
| **OpenClaw CLI változik** | Csak `openclaw.ts` adapter frissül | 30 perc |
| **Új agent framework** | Új adapter implementálása | 2-3 óra |
| **Tesztelés** | Mock provider → unit teszt | 15 perc setup |

## Kapcsolódó PKG-k

- **Függ**: PKG-001 (SvelteKit scaffold + core modulok)
- **Blokkol**: (semmit — párhuzamosítható PKG-002..005-tel, de UTÁNUK refaktorál)

## Log

| Idő | Fázis | Mi történt |
|-----|-------|------------|
| 2026-07-05 11:10 | F0 | Spec elkészítve András kérésére |
