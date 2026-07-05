# PKG-006: Logs Viewer Tab (F-05)

> Státusz: 📋 Spec kész | Méret: S | Roadmap: F-05 P1

## Spec

**Mit**: `lib/core/logs.ts` + `LogsViewer.svelte` — utolsó 500 sor `~/.openclaw/logs/`-ból, színkódolt, filterezhető.

**F0**: spec kész | **F1**: logs.ts (exec tail -500, ERROR/WARN/INFO parse, filter) | **F2**: LogsViewer.svelte (színkódolt sorok, filter bar) | **F3**: collector + index | **F4**: test + build | **F5**: merge
