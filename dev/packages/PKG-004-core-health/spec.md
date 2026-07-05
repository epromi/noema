# PKG-004: Core — Health & Heartbeat Module

> Státusz: 📋 Spec kész | Méret: S | 
> Dependencia: PKG-003 (agent data)

## Spec

**Mit**: `lib/core/health.ts` — heartbeat monitoring, model mapping, uptime tracking.

**Scope**:
- `src/lib/types/index.ts`: HealthData
- `src/lib/core/health.ts`: getHealth()
- `tests/core/health.test.ts`

## Fázisok

### F0 — Spec (~5 perc)
- [ ] Mintát követi (PKG-002/003)

### F1 — Core (~30 perc)
- [ ] `src/lib/types/index.ts`: HealthData, HeartbeatEntry típusok
- [ ] `src/lib/core/health.ts`:
  - `getHealth()` → heartbeat state, model mapping frissesség
  - Gateway státusz: `openclaw gateway status`
  - Disk usage: `df -h`
  - Uptime: `uptime`
  - Memory state: agent score-ok, hook state
- [ ] `tests/core/health.test.ts`
- [ ] `pnpm check` ZÖLD

### F2 — Teszt (~10 perc)
- [ ] `pnpm test` ZÖLD
- [ ] `pnpm build` ZÖLD

### F3 — Merge (~5 perc)
- [ ] Git commit: "🧠 feat: Health & heartbeat module (PKG-004)"
- [ ] Push
