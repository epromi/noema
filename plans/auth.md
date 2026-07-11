# Noema Dashboard Authentication
> 2026-07-11 | P0 | PLANNING | est:45m act:—

## Spec

A Noema dashboard jelenleg minden LAN-on lévő eszköz számára elérhető, nulla authentikációval.
Egy egyszerű jelszó-alapú login + session cookie védi le az összes route-ot és API endpoint-ot,
külső függőség nélkül.

## Plan

SvelteKit `hooks.server.ts` handle hook + httpOnly session cookie.
A jelszó környezeti változóból jön (`NOEMA_AUTH_PASSWORD`), a session titok szintén (`NOEMA_SESSION_SECRET`).
Ha ezek nincsenek beállítva, a dashboard auth nélkül működik (visszafelé kompatibilis).

A `/login` route kivételével minden kérést ellenőrizni kell.
Nem hitelesített kérés → `/login` redirect (oldal route-ok) vagy 401 (API route-ok).
A login form action ellenőrzi a jelszót és session cookie-t állít be.

A cookie: httpOnly, SameSite=Lax, Secure=false (HTTP-only környezet), path=/.
A session 24 óra után lejár, de a cookie max-age ennél hosszabb hogy az inaktivitás ne üssön ki azonnal.

Constraint: a meglévő `hooks.server.ts`-ben lévő collector/watcher inicializálás nem törhet.
Constraint: auth letiltása lehetséges kell legyen (üres NOEMA_AUTH_PASSWORD → no auth).

## Tasks

- [ ] Auth hook integrálva a hooks.server.ts-be  `est:10m/act:—`
  AC: Ha NOEMA_AUTH_PASSWORD be van állítva, a /login kivételével minden route átirányít /login-re
  hitelesítés nélkül. Ha nincs beállítva, a korábbi viselkedés változatlan.

- [ ] Session kezelés — cookie generálás, ellenőrzés, lejárat  `est:10m/act:—`
  AC: Sikeres login után httpOnly session cookie kerül beállításra. A session érvényes 24 óráig.
  Lejárt vagy érvénytelen session esetén a felhasználó visszairányítódik /login-re.

- [ ] Login oldal — form action, jelszó ellenőrzés, hibaüzenet  `est:10m/act:—`
  AC: A /login oldalon jelszó mező + submit gomb. Hibás jelszó esetén hibaüzenet jelenik meg,
  sikeres login után redirect a főoldalra.

- [ ] Login oldal UI — minimalista, a dashboard stílusához illeszkedő dizájn  `est:10m/act:—`
  AC: A login oldal kinézete illeszkedik a dashboard vizuális nyelvéhez (színek, tipográfia, sötét téma).

- [ ] API route védelem — minden /api/* endpoint auth mögött  `est:5m/act:—`
  AC: Auth nélküli hívás /api/* endpointokra 401-et ad vissza, nem redirect-el.
