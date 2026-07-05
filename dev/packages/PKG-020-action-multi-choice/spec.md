# PKG-020: Action Queue — Több választási lehetőség

**Size:** M | **Effort:** 1.5-2h | **Priority:** P1 | **Status:** ⏭️ ABSORBED  
**Absorbed by:** PKG-023 (Orchestrator Tab — Phase 2) | **Spec date:** 2026-07-05

## ⏭️ EZ A PKG MÁR NEM ÖNÁLLÓ

A multi-action gombok implementációját a **PKG-023 Phase 2** tartalmazza. Ez a spec csak referenciaként marad.

### Eredeti spec (referencia)

A Noema Research panelen a `📋 PROPOSE` sorok mellett legyenek több választási lehetőséget kínáló gombok egyetlen checkbox helyett.

**Szintaxis**: `→ [A|B|C]` a PROPOSE sor végén.

**8 action típus**: implement, done, escalate, restart, trigger, investigate, activate, paid

**Visual**: gombcsoport (button group), az aktív action kiemelve, hover tooltip magyarázattal.
