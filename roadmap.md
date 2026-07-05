# Noema 🧠 — Fejlesztési Útiterv

> Forrás: competitive-landscape.md + user visszajelzések + Noema Research cron javaslatok
> Frissítve: 2026-07-05

---

## Prioritási Rendszer

| Jelölés | Jelentés |
|---------|----------|
| 🔴 P0 | Kritikus — azonnal, ma/holnap |
| 🟡 P1 | Fontos — ezen a héten |
| 🟢 P2 | Hasznos — következő 1-2 hét |
| ⚪ P3 | Távoli — 1+ hónap, "nice to have" |

---

## 🔴 P0 — Most / Ma

| ID | Feature | Forrás | Státusz |
|----|---------|--------|---------|
| **F-01** | **Címsor fix**: "Noema Nightly QA" név még "Dashboard Nightly QA" cron listában | Self-review | ✅ Kész |
| **F-02** | **generate.js path fix**: `memory/research/dashboard` → `memory/research/noema` | Self-review | ✅ Kész |
| **F-03** | **JSONL path fix**: `dashboard-actions.jsonl` → `noema-actions.jsonl` | Self-review | ✅ Kész |
| **F-04** | **Orchestrator cron fix**: `0306bef4` gateway restart szükséges | Otto Nightly #54 | ⏳ Függőben |

---

## 🟡 P1 — Ezen a Héten

| ID | Feature | Forrás | Effort | Státusz |
|----|---------|--------|--------|---------|
| **F-05** | **Logs Viewer Tab** — Utolsó 500 sor `~/.openclaw/logs/`-ból, színkódolt (ERROR=piros, WARN=sárga, INFO=kék), filter (All/Errors/Warnings) | Hermes Studio | 2-3h | 📋 Spec kész |
| **F-06** | **Audit Trail / Activity Feed** — Kronologikus timeline: session start, agent spawn, cron trigger, error, action processor event. Session-enként filterezhető | Hermes Studio | 2-3h | 📋 Spec kész |
| **F-07** | **Cron Health Timeline** — Utolsó 24 óra Gantt-szerű futási sávok cron-onként. Látszik: mikor futott, mennyi ideig, OK/ERROR színnel | Grafana best practice | 2h | 📋 Spec kész |
| **F-08** | **Session Phase Tracking** — Agent státusz upgrade: "Online/Error" → "Processing/Idle/Awaiting/Stuck". Session list API-ból + timeout heurisztika | Hermes Dashboard | 1.5h | 📋 Spec kész |

---

## 🟢 P2 — Következő 1-2 Hét

| ID | Feature | Forrás | Effort | Státusz |
|----|---------|--------|--------|---------|
| **F-09** | **Knowledge Graph Vizualizáció** — D3.js force-directed graph a `nodes.json` + `edges.json`-ból. Interaktív: zoom, pan, node drag, hover tooltip | Hermes Studio | 5-8h | 📋 Kutatva |
| **F-10** | **Cost Tracking** — API token usage / költség agent-enként. Model metadata → $/1K tokens → becsült költség. Per-agent és összesített | Hermes Studio | 3-4h | 📋 Kutatva |
| **F-11** | **Auto-Generated Wiki** — Agent fájlokból, configból, skill-ekből auto-generált, kereshető dokumentáció. Read-only, filesystem-ből élőben | Hermes Dashboard | 4-6h | 📋 Kutatva |
| **F-12** | **Subagent Status Panel** — Session-enként: spawn time, státusz, tool call count, completion time, success/error. Timeline vizualizáció | Hermes Dashboard | 2-3h | 📋 Kutatva |
| **F-13** | **Template JS Kiszervezés** — A ~920 soros HTML-ből a JS renderer kiszervezése külön `<script>` fájlba. Karbantarthatóság ↑ | Code Quality | 1-2h | 📋 Kutatva |

---

## ⚪ P3 — Távoli (1+ Hónap)

| ID | Feature | Forrás | Effort | Státusz |
|----|---------|--------|--------|---------|
| **F-14** | **Quality Gate / Approval System** — Bizonyos műveletek (H1 submit, file törlés) ne menjenek át explicit review nélkül. Aegis mintájára | Mission Control | 10-15h | 📋 Kutatva |
| **F-15** | **Session Trace Tree** — Egy session teljes tool call fája, faszerkezetben. LangSmith-szerű trace vizualizáció | LangSmith | 8-12h | 📋 Kutatva |
| **F-16** | **ClawHub Integration** — Skill-ek böngészése, telepítése, toggle a dashboardról. Verziókövetés | Mission Control | 6-10h | 📋 Kutatva |
| **F-17** | **WebSocket Real-Time** — Push frissítések page refresh helyett. SSE vagy WebSocket a relay.js-en keresztül | Mission Control | 8-12h | 📋 Kutatva |
| **F-18** | **Több Téma** — Light mode, kontraszt mód, több színséma (mint a Hermes Studio 8 témája) | Hermes Studio | 3-5h | 📋 Kutatva |
| **F-19** | **Mobile PWA** — Reszponzív design optimalizálás mobilon, PWA manifest, offline cache | Hermes Studio | 4-6h | 📋 Kutatva |

---

## 🛠️ Technikai Adósság

| ID | Leírás | Priority | Státusz |
|----|--------|----------|---------|
| **TD-01** | `D.dashboardResearch` → `D.noemaResearch` átnevezés (template + generate.js) | P2 | ⏳ |
| **TD-02** | Régi `dashboard/` backup fájlok takarítása (2×66KB) | P3 | ⏳ |
| **TD-03** | `generate.js` szétbontása modulokra (fetch / process / render) | P2 | ⏳ |
| **TD-04** | Template CSS rendszerezése (ismétlődő stílusok konszolidálása) | P3 | ⏳ |
| **TD-05** | Cron név + leírás szinkron `jobs.json` ↔ `cron list` között | P1 | ⏳ |

---

## 📊 Státusz Összesítő

| Prioritás | Összes | Kész | Függőben |
|-----------|--------|------|----------|
| 🔴 P0 | 4 | 3 | 1 |
| 🟡 P1 | 4 | 0 | 4 |
| 🟢 P2 | 5 | 0 | 5 |
| ⚪ P3 | 6 | 0 | 6 |
| **Összes** | **19** | **3** | **16** |

---

## Hogyan Kerülnek Fel Új Feature-ök

1. **Noema Research cron** (01:00) — automatikusan keres feature ötleteket a competitive landscape-ből + web research-ből
2. **Noema Nightly QA** (03:00) — review-zza a kódminőséget, technikai adósságot jelez
3. **Alfred** — manuális kutatás alapján, felhasználói kérésre
4. **András** — közvetlen feature request

Minden új feature:
- Kap egy F-XX ID-t
- Prioritást (P0-P3) a fenti rendszer szerint
- Forrás megjelölést (honnan jött az ötlet)
- Effort becslést
- A CHANGELOG.md-be kerül implementáláskor
