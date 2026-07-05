# PKG-009: SSE Live Updates (F-17)

> Státusz: 📋 Spec kész | Méret: M | Roadmap: F-17 P3 (elevated: v2 alapkövetelmény)

## Spec

**Mit**: `lib/server/sse.ts` + `routes/api/events/+server.ts` — Server-Sent Events live update. A collector ciklus végén broadcast az új adat, a böngésző valós időben frissül.

**F0**: spec | **F1**: sse.ts (client set, broadcast, auto cleanup), events route (SSE stream) | **F2**: frontend EventSource integration | **F3**: collector hook (broadcast after each cycle) | **F4**: test (EventSource működik, reconnect) | **F5**: merge

> ⚠️ Függ: PKG-001 (scaffold) + legalább 2 core modul kell a teszteléshez
