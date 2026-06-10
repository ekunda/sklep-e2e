# sklep-e2e — Testcontainers + Playwright w praktyce

Działający projekt szkoleniowy: mały sklep (**Express + PostgreSQL + Redis**)
z dwoma poziomami testów na **prawdziwej infrastrukturze** — bez mocków bazy.

| Poziom | Narzędzia | Co sprawdza |
|---|---|---|
| **Integracyjne** | Vitest + Testcontainers + supertest | API ↔ prawdziwy Postgres + Redis (bez UI) |
| **E2E** | Playwright + Testcontainers | Pełny flow użytkownika w przeglądarce |

> 🎞️ **Prezentacja:** otwórz [`../prezentacja.html`](../prezentacja.html) — interaktywny
> deck (17 slajdów, nawigacja ←/→) prowadzący przez cały projekt: koncepcje,
> architekturę, cykl życia testów, CI i realne bugi złapane przez pipeline.

---

## Wymagania

- **Node.js ≥ 20**
- **pnpm ≥ 9** — aktywuj przez corepack (idzie z Node): `corepack enable`
- **Docker** — uruchomiony silnik (Docker Desktop na Windows). Bez niego
  Testcontainers nie wystartują. Sprawdź: `docker info`.

> Brak działającego Dockera lokalnie? Wypchnij na GitHub — **CI ma Dockera
> preinstalowanego** ([`.github/workflows/tests.yml`](.github/workflows/tests.yml)),
> albo użyj Testcontainers Cloud.

---

## Instalacja

```bash
corepack enable                          # aktywuje pnpm
pnpm install
pnpm exec playwright install chromium    # przeglądarka do E2E
```

---

## Uruchomienie

### Testy integracyjne (Vitest + Testcontainers)

```bash
pnpm test:integration
```

`tests/integration/global-setup.ts` startuje kontenery Postgres + Redis **raz**,
zakłada schemat i przekazuje connection stringi do testów przez
`provide()`/`inject()` (w Vitest `process.env` z global-setup **nie** dociera do
workerów — trzeba użyć `provide`). Każdy test czyści bazę w `beforeEach` i
seeduje własne dane.

### Testy E2E (Playwright)

```bash
pnpm test:e2e          # headless
pnpm test:e2e:headed   # z widoczną przeglądarką
pnpm test:e2e:ui       # interaktywny tryb UI
pnpm test:e2e:report   # otwórz raport HTML po przebiegu
```

`tests/e2e/global-setup.ts` startuje kontenery, zakłada schemat i uruchamia
serwer aplikacji **w tym samym procesie** (na :3000). Fixtures
(`tests/e2e/fixtures.ts`) seedują użytkownika i produkt per test przez trasy
`/api/test/*`.

### Aplikacja w trybie dev (opcjonalnie)

Wymaga własnego Postgresa i Redisa; skonfiguruj `.env` na bazie `.env.example`:

```bash
cp .env.example .env
pnpm dev      # http://localhost:3000
```

---

## Mapa projektu → tematy ze szkolenia

```
src/
  app.ts                 # createApp(config) — DI, testowalność
  server.ts              # entry dev/prod
  db.ts, redis.ts        # połączenia
  migrations.ts          # schemat bazy
  auth.ts                # JWT + bcrypt + middleware
  async-handler.ts       # poprawna obsługa błędów async w Express 4
  routes/
    auth.routes.ts
    products.routes.ts   # cache w Redis
    orders.routes.ts     # transakcja + kontrola stanu magazynu
    test.routes.ts       # seed/cleanup, chronione NODE_ENV
  public/                # frontend (HTML+JS) — to klika Playwright

tests/
  helpers/               # seed.ts, db-cleaner.ts, test-app.ts
  integration/           # global-setup (provide/inject) + auth/orders
  e2e/                   # global-setup (kontenery + serwer), fixtures, specs

.github/workflows/tests.yml  # CI: integracja + E2E z shardingiem (pnpm)
playwright.config.ts         # trace: on-first-retry
vitest.config.ts
pnpm-workspace.yaml          # decyzje o skryptach build (pnpm 11)
```

---

## Najważniejsze decyzje (i dlaczego)

- **`createApp(config)` zamiast globalnych singletonów** — testy podają URL-e
  z Testcontainers bezpośrednio. Fundament testowalności.
- **Vitest: `provide`/`inject`, nie `process.env`** — zmienne z global-setup nie
  docierają do workerów.
- **Integracja: `fileParallelism: false`** — pliki dzielą jeden kontener, więc
  czyszczenie bazy nie może się ścigać między plikami.
- **E2E: serwer startuje w global-setup, nie w `webServer`** — `webServer`
  odpala się *przed* global-setup, a serwer potrzebuje URL-i z kontenerów.
- **`trace: "on-first-retry"`** — pełna „czarna skrzynka" tylko gdy trzeba.
- **pnpm 11 + `pnpm-workspace.yaml`** — skrypty `postinstall` zależności są
  domyślnie blokowane (bezpieczeństwo); jawnie deklarujemy `allowBuilds`.

---

## Czego nauczyło nas CI (a `tsc` nie złapał)

Dwa prawdziwe bugi wyszły dopiero przy uruchomieniu testów w pipeline:

1. **Rozjazd źródeł prawdy** — montowanie tras `/api/test/*` czytało
   `config.nodeEnv`, a strażnik `process.env.NODE_ENV`. Vitest ustawia je sam,
   Playwright nie → 403 w fixtures. Fix: `NODE_ENV=test` w E2E global-setup.
2. **Za szeroki selektor** — `[data-testid^="order-"]` łapał też banner
   `order-confirmation`. Fix: wiersze zamówień mają prefiks `order-row-`.

---

## Debugowanie nieudanego testu E2E (trace)

```bash
pnpm exec playwright test --trace on        # wymuś nagrywanie
pnpm exec playwright show-report            # raport HTML z osadzonym trace
pnpm exec playwright show-trace trace.zip   # konkretny plik trace
```

W Trace Viewerze: timeline akcji, screenshoty, sieć (HTTP) i konsola — dokładnie
w punkcie, w którym test się wywrócił.
