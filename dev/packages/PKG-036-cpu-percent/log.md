# PKG-036 Log

## 2026-07-07

- F2: `CpuWidget.svelte` — bar mode shows `CPU: N% (load1 load5 load15)` via `$derived cpuPercent`
- F1 skipped: no core changes required (`load1`, `coreCount` already in `CpuData`)
- Gate fix: `cron-utils.test.ts` null narrowing for pre-existing svelte-check errors
