# sklep-e2e — Testcontainers + Playwright w praktyce

Działający projekt do szkolenia **„Integracje i e2e: Testcontainers + Playwright”**.
Mały sklep (użytkownicy, produkty, koszyk, zamówienia) na stacku
**Express + PostgreSQL + Redis**, z dwoma poziomami testów:

| Poziom | Narzędzia | Co sprawdza |
|---|---|---|
| **Integracyjne** | Vitest + Testcontainers + supertest | API ↔ prawdziwy Postgres + Redis (bez UI) |
| **E2E** | Playwright + Testcontainers | Pełny flow użytkownika w przeglądarce |

---

## Wymagania

- **Node.js ≥ 20** (masz 24 ✔)
- **Docker** — uruchomiony silnik (Docker Desktop na Windows). Bez niego
  Testcontainers nie wystartują. Sprawdź: `docker info`.

> Jeśli `docker` nie jest rozpoznawany, zainstaluj **Docker Desktop**
> (https://www.docker.com/products/docker-desktop/) i upewnij się, że jest
> uruchomiony (ikona w trayu „Engine running”).

---

## Instalacja

```bash
npm install
npx playwright install chromium   # przeglądarka do testów E2E
```

---

## Uruchomienie

### Testy integracyjne (Vitest + Testcontainers)

```bash
npm run test:integration
```

Co się dzieje: `tests/integration/global-setup.ts` startuje kontenery
Postgres + Redis **raz**, zakłada schemat i przekazuje connection stringi do
testów przez `provide()`/`inject()`. Każdy test czyści bazę w `beforeEach`
(izolacja) i seeduje własne dane.

### Testy E2E (Playwright)

```bash
npm run test:e2e          # headless
npm run test:e2e:headed   # z widoczną przeglądarką
npm run test:e2e:ui       # interaktywny tryb UI
npm run test:e2e:report   # otwórz raport HTML po przebiegu
```

Co się dzieje: `tests/e2e/global-setup.ts` startuje kontenery, zakłada schemat
i uruchamia serwer aplikacji **w tym samym procesie** (na :3000). Fixtures
(`tests/e2e/fixtures.ts`) seedują użytkownika i produkt per test przez trasy
`/api/test/*`.

### Aplikacja w trybie dev (opcjonalnie)

Wymaga własnego Postgresa i Redisa (np. `docker compose`), skonfiguruj `.env`
na bazie `.env.example`:

```bash
cp .env.example .env
npm run dev      # http://localhost:3000
```

---

## Mapa projektu → tematy ze szkolenia

```
src/
  app.ts                 # createApp(config) — DI, testowalność (sekcja 7)
  server.ts              # entry dev/prod
  db.ts, redis.ts        # połączenia (sekcja 2)
  migrations.ts          # schemat bazy
  auth.ts                # JWT + bcrypt + middleware
  async-handler.ts       # poprawna obsługa błędów async w Express 4
  routes/
    auth.routes.ts
    products.routes.ts   # cache w Redis
    orders.routes.ts     # transakcja + kontrola stanu magazynu
    test.routes.ts       # seed/cleanup, chronione NODE_ENV (sekcja 5.6)
  public/                # frontend (HTML+JS) — to klika Playwright

tests/
  helpers/
    seed.ts              # seed per test (sekcja 3)
    db-cleaner.ts        # cleanDatabase + cleanRedis (sekcja 2.6)
    test-app.ts          # createApp wpięty w inject()
  integration/
    global-setup.ts      # Testcontainers + provide/inject (sekcja 2, 7)
    auth.test.ts
    orders.test.ts       # transakcja, rollback, cache
  e2e/
    global-setup.ts      # kontenery + serwer (sekcja 7.6)
    global-teardown.ts
    fixtures.ts          # custom fixtures, seed per test (sekcja 5)
    auth.spec.ts         # logowanie po UI
    shopping.spec.ts     # pełny flow zakupowy

.github/workflows/tests.yml  # CI: integracja + E2E z shardingiem (sekcja 8)
playwright.config.ts         # trace: on-first-retry (sekcja 6)
vitest.config.ts
```

---

## Najważniejsze decyzje (i dlaczego)

- **`createApp(config)` zamiast globalnych singletonów** — testy podają URL-e
  z Testcontainers bezpośrednio. To fundament testowalności.
- **Vitest: `provide`/`inject`, nie `process.env`** — zmienne ustawione w
  global-setup Vitest **nie** docierają do workerów; trzeba użyć `provide`.
- **Integracja: `fileParallelism: false`** — pliki współdzielą jeden kontener,
  więc czyszczenie bazy nie może się ścigać między plikami.
- **E2E: serwer startuje w global-setup, nie w `webServer`** — `webServer`
  odpala się *przed* global-setup, a serwer potrzebuje URL-i z kontenerów.
- **`trace: "on-first-retry"`** — pełna „czarna skrzynka” tylko gdy trzeba.

---

## Debugowanie nieudanego testu E2E (trace)

```bash
npx playwright test --trace on        # wymuś nagrywanie
npx playwright show-report            # raport HTML z osadzonym trace
npx playwright show-trace trace.zip   # konkretny plik trace
```

W Trace Viewerze zobaczysz timeline akcji, screenshoty, sieć (HTTP) i konsolę —
dokładnie w punkcie, w którym test się wywrócił.
