# PKG-030 Suggestions

## Required API route (out of spec file list)

`GET /api/logs` was added at `src/routes/api/logs/+server.ts` so `LogsViewer` can poll without calling `lib/core` directly (architecture rule #3). Mirrors existing `GET /api/log/[pkgId]`.

## LogsViewer vs LogPanel sort semantics

Both share `localStorage` key `log-reversed`, but `LogsViewer` inverts the display transform so default (`"0"`) shows **newest first** (spec §4) while `LogPanel` default shows **oldest first** (spec §2). Toggling to `"1"` flips both views. Consider separate keys if unified ↑/↓ meaning across views is required.

## Duplicate polling on dev-loop logs

`+page.svelte` still polls at 3s when a log panel is open; `LogPanel` now polls at 5s. Consider removing parent polling in a follow-up package to avoid duplicate `/api/log/*` requests.
