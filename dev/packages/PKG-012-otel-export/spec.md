# PKG-012: OTel Export (F-22)

> Státusz: 📋 Spec kész | Méret: S (leminősítve M→S) | Roadmap: F-22 P3 (leminősítve P2→P3)
> ⚠️ Prioritás csökkentve — lásd review notes

## Korrekció (2026-07-05 11:00)

**Túlzó keretezés**: Az OTel GenAI egy valós iparági szabvány DE:
- Elosztott, multi-service rendszerekhez tervezték
- Single-user, single-machine dashboard esetén az OTel collector + span infra aránytalan overhead
- A "konvergencia" az LLM observability platformok (LangSmith, Langfuse) között van — nem a mi kategóriánk

**Valós érték**: Ha egyszer Noema adatot akarunk küldeni Grafana-ba, akkor az OTel span formátum a standard. De ez nem "gap" — ez opcionális integráció.

**Átkeretezve**: P2→P3, "industry gap" → "opcionális integráció"

## Spec

**Mit**: Opcionális OTel span export. Ha a felhasználó akarja, bekapcsolja és a Noema core modulok span-eket küldenek OTLP endpoint-ra. Ha nincs collector, file-ba ír.

**Scope**:
- `lib/core/otel-exporter.ts` — lightweight wrapper, NEM az OTel JS SDK (túl nagy)
- Span típusok: CRON_RUN, AGENT_SPAWN, SESSION_COMPLETE, DATA_COLLECT
- Export: OTLP HTTP (opcionális) + file fallback (mindig)

## Fázisok (egyszerűsítve, S méret)

### F1 — Core (~30 perc)
- [ ] `lib/core/otel-exporter.ts`: saját lightweight span format (nem OTel SDK)
  - `startSpan(name, attributes)` → `endSpan()` 
  - Export JSONL-be: `memory/state/spans.jsonl`
- [ ] OTLP HTTP endpoint ha konfigurálva van

### F2 — Integráció (~15 perc)
- [ ] Környezeti változó: `NOEMA_OTEL_ENDPOINT` (ha üres → file only)
- [ ] Collector ciklus végén flush

### F3 — Merge (~5 perc)
