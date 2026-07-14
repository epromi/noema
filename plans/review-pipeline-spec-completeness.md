# Review Pipeline — Spec Grounding (Claim Verification)
> 2026-07-13 | P0 | DONE | est:5m act:5m

## Spec

A PKG-040 post-mortem root cause-ja: a review ellenőrzi a kód minőségét, tesztjeit, architektúráját — de soha nem verifikálja hogy a spec állításai a valóságban igazak-e. A probléma nem fájl-specifikus és nem taxonomizálható: bármilyen típusú claim lehet a spec-ben. A javítás egyetlen process szabály ami kimondja: **minden spec claim-et vissza kell ellenőrizni a valóságra mielőtt a review kész.**

## Plan

A review-rigor `prompts/universal-analyzer.md` Phase 5 (Synthesize) elejére kerül egy új kötelező lépés: **"Spec Grounding"**. Ez nem egy új lens, nem egy taxonómia — egyetlen szabály ami a reviewer-t arra kötelezi hogy trace-elje vissza a spec állításokat. A reviewer maga dönti el hogyan verifikálja az adott állítást (git diff, fájl tartalom, SSR output, API hívás). Amit nem tud verifikálni → ⚠️ manual verification.

## Tasks

- [x] universal-analyzer.md: "Spec Grounding" lépés Phase 5 (Synthesize) elé `est:5m/act:5m`
  AC: A Phase 5 első lépéseként a reviewer köteles: (1) visszamenni a spec-hez, (2) minden acceptance criteria-t egyesével ellenőrizni hogy a valóságban teljesült-e, (3) a verifikáció eredményét dokumentálni (✅/⚠️/❌), (4) csak ezután folytatni a Synthesis-sel. Nincs előre definiált taxonómia — a reviewer a claim típusától függően választ verifikációs módszert.
