# Noema vs Industry Review — KORRIGÁLVA

> Eredeti: 2026-07-05 10:30 | Korrigálva: 2026-07-05 11:00
> ⚠️ A korrekció okai: 3 félreértés a források értelmezésében

## Félreértések és Korrekciók

### 1. ❌ Eredeti: "Hiányzik az eval layer (Braintrust)"

**Amit a Braintrust csinál**: LLM válaszok minőségbírálata (prompt engineering, regression tesztelés).
**Amit a Noema csinál**: Rendszer szintű monitoring (cron státusz, agent egészség, adatfrissesség).
**Miért félreértés**: A Braintrust eval arra való hogy "jó választ adott-e a modell", a Noema pedig arra hogy "lefutott-e a cron". Teljesen más problématér. Olyan mintha a Teslából hiányolnánk a hajócsavart mert a QM2-nek van.

**✅ Korrekció**: A Noema QA cron (`eed1df55`) — template integritás, adatfrissesség — PONTOSAN azt csinálja amit egy agent ecosystem monitoring-nak kell. Nincs gap.

**🆕 Ami valóban hasznos**: "Agent Session Health Scoring" — rendszer-metrikák alapú egészségpontozás (completion, efficiency, error rate, loop detection). NEM LLM eval, hanem rendszer health. Ez az amit PKG-011 mostantól jelent.

### 2. ❌ Eredeti: "Hiányzik a reasoning trace (Braintrust 4 pillars)"

**Amit a Braintrust ért "reasoning" alatt**: Az LLM belső gondolkodási lánca **egyetlen API híváson belül** — a modell "gondolatmenete".
**Amit a Noema lát**: Agent session-ök tool call sorozata — több API hívás, több tool.
**Miért félreértés**: A Braintrust "reasoning steps" pillére az LLM chain-of-thought-ra vonatkozik prompt→response-on belül. Ez NEM ugyanaz mint az agent "miért ezt a tool-t választotta". A Zylos.ai maga mondja: "fundamentally difficult" — nyitott kutatási probléma, nem implementálható feature.

**✅ Korrekció**: Nincs "reasoning trace" gap mert senkinél nincs megoldva. Ez nem a Noema hiányossága.

**🆕 Ami valóban hasznos**: "Agent Decision Trace" — a tool call-ok sorozatának strukturált vizualizációja. Mit csinált, milyen sorrendben, mi volt a tool output, hogyan befolyásolta a következő döntést. Ez implementálható és többet ad mint a Hermes Studio "Audit Trail" (ami csak eseménylista, nem döntési fa).

### 3. ❌ Eredeti: "OTel GenAI = kihagyhatatlan iparági standard"

**Ami az OTel**: Valós iparági szabvány, DE elosztott multi-service rendszerekhez.
**Single-user, single-machine kontextus**: Az OTel collector + span konfiguráció aránytalan overhead.
**A "konvergencia"**: LangSmith, Langfuse, Arize platformok között — mind más kategória mint a Noema.

**✅ Korrekció**: Nem gap. Opcionális integráció ha egyszer Grafana/Jaeger kompatibilitás kell.

---

## Javított Összehasonlító Tábla

| Dimenzió | Amit az iparág csinál | Noema | Egyezés |
|----------|----------------------|-------|---------|
| **Framework** | SvelteKit növekvő (300% YoY) | ✅ SvelteKit | 🟢 OK |
| **Architektúra** | Modular, testable | ✅ `lib/core/` agnostic | 🟢 Saját innováció |
| **Data pipeline** | System-level monitoring | ✅ Cron + 22 forrás | 🟢 OK |
| **Live updates** | SSE / WebSocket | ✅ SSE betervezve | 🟢 OK |
| **Self-hosted** | "Zero external deps" | ✅ python3 http | 🟢 OK |
| **Multi-agent** | Cascade visibility | ✅ Agent roster + status | 🟢 OK |
| ~~**LLM eval layer**~~ | ~~Más kategória~~ | ~~Nem releváns~~ | ~~N/A~~ |
| ~~**LLM reasoning trace**~~ | ~~Nyitott kutatási probléma~~ | ~~Nem megoldható feature~~ | ~~N/A~~ |
| ~~**OTel GenAI**~~ | ~~Elosztott rendszerekhez~~ | ~~Opcionális integráció~~ | ~~N/A~~ |

## Ami VALÓBAN hiányzik és VALÓBAN hasznos

| PKG | Mit | Miért hasznos | Priority |
|-----|-----|---------------|----------|
| PKG-010 | **Agent Decision Trace** | Tool call fa → látszik a döntési lánc (több mint eseménylista) | P2 |
| PKG-011 | **Session Health Scoring** | Rendszer-metrika alapú egészségpontozás (completion, efficiency, error, loop) | P2 |
| PKG-012 | **OTel Export** (opcionális) | Ha egyszer Grafana integráció kell | P3 |

## Következtetés (Javított)

A Noema architektúra és feature set **jól illeszkedik arra a problémára amit megold**: single-user, single-machine agent ecosystem monitoring. A Braintrust/LangSmith/Langfuse **más kategória** (LLM observability és eval), nem közvetlen összehasonlítási alap.

Ami a Noema-t megkülönbözteti:
1. **Framework-agnostic core** — egyik konkurens sem dokumentál ilyen architektúrát
2. **OpenClaw-native** — egyetlen dashboard ami érti a 49 cron job-ot, a 10 agent-et, a Telegram delivery-t
3. **Self-hosted, zero deps** — python3 http.server, semmi más

Ami épül:
- Agent Decision Trace (PKG-010) — döntési lánc vizualizáció
- Session Health Scoring (PKG-011) — rendszer-egészség metrika
- OTel Export (PKG-012) — opcionális, alacsony prioritás
