# PKG-012: OTel GenAI Export (F-22)

> Státusz: 📋 Spec kész | Méret: M | Roadmap: F-22 P2
> Forrás: Industry Review 2026 — DigitalApplied "OTel GenAI v1.41", Zylos.ai convergence analysis

## Spec

**Mit**: OpenTelemetry GenAI span export a Noema core modulokból. Minden adatgyűjtési művelet (agent státusz, cron trigger, session trace) automatikusan OTel span-ként exportálódik. Noema a "frontend" vizualizáció, OTel a "backend" trace formátum.

**Miért**: Az OTel GenAI v1.41 az iparági konvergencia pont. Langfuse, Arize, LangSmith, Braintrust mind OTel-re épül. Ha Noema is OTel span-eket exportál, a trace-eket bármilyen külső eszközben (Grafana, Jaeger, Zipkin) meg tudjuk nyitni. Nem zárjuk be magunkat egy zárt formátumba.

**Scope**:
- `lib/core/otel-exporter.ts` — OTel SDK wrapper
- Standard GenAI span típusok: AGENT_SPAWN, TOOL_CALL, SESSION_COMPLETE, CRON_TRIGGER
- Export: OTLP HTTP (localhost:4318) + file fallback (JSON)
- Opcionális: collector indítása (Docker, de nem kötelező)

**Out of scope**:
- Nem telemetria minden egyes tool call-ról (túl drága lenne)
- Csak a Noema core modulokból exportál, nem az agent runtime-ból
- Nincs distributed tracing (single machine)

## Fázisok

### F0 — Spec (~15 perc)
- [ ] OTel JS SDK verzió ellenőrzése
- [ ] GenAI semantic conventions v1.41 áttekintése
- [ ] Export target eldöntése: OTLP endpoint + file fallback

### F1 — Core: OTel Exporter (~60 perc)
- [ ] `lib/types/index.ts`: OtelSpan, SpanKind, SpanStatus típusok
- [ ] `lib/core/otel-exporter.ts`:
  - `initOtel()` — SDK inicializálás (opcionális, ha nincs collector → file fallback)
  - `startSpan(name, kind, attributes)` → span objektum
  - `endSpan(span, status)` → lezárás
  - `createAgentSpawnSpan(agentId, task)` → AGENT_SPAWN
  - `createToolCallSpan(agentId, tool, args, result)` → TOOL_CALL
  - `createCronTriggerSpan(cronId, label, result)` → CRON_TRIGGER
  - `createSessionSpan(sessionKey, agentId)` → SESSION_COMPLETE
  - `exportTraces()` → OTLP HTTP POST + file write
- [ ] Auto-export: minden collector ciklus végén hívódik
- [ ] `tests/core/otel-exporter.test.ts`: span creation + export
- [ ] `pnpm check` ZÖLD

### F2 — Integráció (~30 perc)
- [ ] `lib/core/collector.ts`: span creation az adatgyűjtések köré
- [ ] Környezeti változók:
  - `OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318` (default)
  - `OTEL_DISABLED=true` → file-only fallback
- [ ] File export: `memory/state/otel-spans.jsonl` (új soronként egy span)
- [ ] `pnpm check` ZÖLD

### F3 — Dokumentáció (~15 perc)
- [ ] `otel-setup.md`: hogyan kell OTel collector-t indítani
- [ ] Grafana + Jaeger integrációs példa
- [ ] No OTel collector? File-ból is működik

### F4 — Teszt (~20 perc)
- [ ] `pnpm test` ZÖLD
- [ ] `pnpm build` ZÖLD
- [ ] Manuális: span-ok megjelennek a JSONL fájlban

### F5 — Merge (~10 perc)
- [ ] Git commit: "🧠 feat: OTel GenAI Export (F-22, PKG-012)"
- [ ] Push

## Log

| Idő | Fázis | Mi történt |
|-----|-------|------------|
| 2026-07-05 10:50 | F0 | Spec elkészítve |
