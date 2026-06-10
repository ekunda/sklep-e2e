# HANDOFF — przeniesienie i historia projektu

Ten plik to „pamięć projektu”: jak przenieść repo na inny komputer + co i dlaczego
zbudowaliśmy (wraz z pułapkami, które realnie złapaliśmy). Wszystko ważne jest
w repo lub łatwe do odtworzenia — nie potrzebujesz nic poza `git clone`.

---

## 1. Przeniesienie na laptopa (3 kroki)

```bash
# 1) sklonuj repo (pobierze też gałęzie demo broken/*)
git clone https://github.com/ekunda/sklep-e2e.git
cd sklep-e2e

# 2) narzędzia
corepack enable                         # aktywuje pnpm (idzie z Node ≥ 22.13)
pnpm install
pnpm exec playwright install chromium   # przeglądarka do E2E

# 3) sklep na żywo BEZ Dockera (do klikania / prezentacji)
pnpm demo                               # http://localhost:3000/login.html
                                        # login: demo@sklep.pl / demo1234
```

Testy (wymagają **uruchomionego Dockera**):
```bash
pnpm test:integration     # Vitest + Testcontainers (Postgres + Redis w kontenerach)
pnpm test:e2e             # Playwright
pnpm exec playwright show-report
```

Gałęzie demo do ćwiczenia „złam i napraw” (są na origin):
```bash
git fetch origin
git switch broken/selector   # zły selektor (przycisk „Kup teraz” nie istnieje)
git switch broken/node-env   # brak NODE_ENV=test → fixtures dostają 403
git switch main
```

> **Co NIE jest w repo (i nie trzeba):** lokalny PDF prezentacji (regenerujesz:
> `node tools/export-pdf.mjs`), pobrane trace (są w artefaktach CI), oraz lokalna
> pamięć Claude Code. Cały kontekst projektu jest w tym pliku i w `szkolenie/`.

---

## 2. Co jest w repo (mapa)

```
src/                      # aplikacja (Express + PostgreSQL + Redis)
  app.ts                  # createApp(config) — wstrzykiwanie zależności (testowalność)
  routes/                 # auth, products (cache Redis), orders (transakcja), test (seed/cleanup)
  demo-server.ts/-db.ts   # tryb DEMO na PGlite (Postgres w WASM) — bez Dockera
  public/                 # frontend (HTML+JS) — to klika Playwright
tests/
  integration/            # Vitest + Testcontainers (global-setup z provide/inject)
  e2e/                    # Playwright (fixtures, global-setup z kontenerami+serwerem)
  helpers/                # seed.ts, db-cleaner.ts, test-app.ts
szkolenie/                # PROGRAM SZKOLENIOWY
  README.md               # 7 modułów + refaktoryzacja + sekcja zaawansowana
  WARSZTAT.md             # wersja prowadzona (skrót)
  PORADNIK-PROWADZACEGO.md# jak prowadzić, dobre/złe testy, „złam i napraw”, pytania
  KARTA-PROWADZACEGO.md   # 1 strona A4 do druku
docs/index.html           # interaktywna prezentacja (serwowana przez GitHub Pages)
tools/export-pdf.mjs      # generowanie PDF prezentacji
.github/workflows/tests.yml # CI: integracja + E2E (sharding ×2) na pnpm
```

Linki na żywo:
- Prezentacja: **https://ekunda.github.io/sklep-e2e/**
- Repo + CI: **https://github.com/ekunda/sklep-e2e**

---

## 3. Historia i kluczowe decyzje (skrót „rozmowy”)

**Co budowaliśmy:** działający sklep e-commerce jako baza do nauki testów
integracyjnych (Testcontainers) i E2E (Playwright), a potem cały program szkoleniowy
wokół niego.

**Najważniejsze decyzje architektoniczne:**
- `createApp(config)` zamiast globalnych singletonów — testy podają URL-e (lub gotowe
  instancje) z zewnątrz. Fundament testowalności.
- Integracyjne: jeden kontener na przebieg, `fileParallelism: false`, czyszczenie bazy w `beforeEach`.
- E2E: serwer startuje w `global-setup` (nie w `webServer`), bo `webServer` rusza ZANIM global-setup.
- `trace: "on-first-retry"` — czarna skrzynka tylko gdy trzeba.

**Pułapki, które realnie nas ugryzły (świetny materiał szkoleniowy):**
1. **Docker/WSL2 nie działa lokalnie** (AMD Ryzen 9800X3D, X870, beta BIOS, konflikt z
   Memory Integrity). Obejście: testy w CI + tryb `pnpm demo` na PGlite. Bezpieczeństwo
   (HVCI/VBS) zostało przywrócone — wymaga restartu Windows.
2. **Vitest:** `process.env` z global-setup NIE dociera do workerów → trzeba `provide`/`inject`.
3. **Bug znaleziony przez CI:** trasy `/api/test/*` montowane wg `config.nodeEnv`, ale strażnik
   czyta `process.env.NODE_ENV` — Vitest ustawia je sam, Playwright nie → 403 w fixtures.
   Fix: `process.env.NODE_ENV = "test"` w e2e global-setup.
4. **Bug znaleziony przez CI:** selektor `[data-testid^="order-"]` łapał też banner
   `order-confirmation` → `toHaveCount(1)` dostawał 2. Fix: wiersze mają prefiks `order-row-`.
5. **pnpm 11:** zgody na skrypty build są w `pnpm-workspace.yaml` (`allowBuilds`), nie w
   package.json; pnpm 11 wymaga **Node ≥ 22.13** (stąd Node 22 w CI).
6. **PGlite:** `db.query()` (protokół rozszerzony) nie wykona wielu poleceń naraz — schemat
   ładujemy przez `db.exec()`.
7. **Playwright `getByRole(name)` dopasowuje FRAGMENT** (substring): literówka „Do koszyka”
   wciąż pasuje do „Dodaj do koszyka” i test PRZECHODZI. Żeby realnie zepsuć — nazwa, której
   nie ma w tekście, albo `{ name, exact: true }`. (Potwierdzone PR-em #1: zielone → czerwone.)

**Materiały szkoleniowe:** patrz `szkolenie/`. Format: program 7-modułowy (`README.md`),
wersja prowadzona (`WARSZTAT.md`), poradnik prowadzącego z ćwiczeniem „złam i napraw”
i przykładami dobre/złe (`PORADNIK-PROWADZACEGO.md`), karta A4 (`KARTA-PROWADZACEGO.md`),
oraz gałęzie demo `broken/selector` i `broken/node-env`.

**Stan:** `main` jest zielony (CI: integracja + E2E ×2 shardy). Repo publiczne, Pages działa.

---

## 4. Regeneracja prezentacji do PDF
```bash
node tools/export-pdf.mjs   # czyta docs/index.html → tworzy ../prezentacja.pdf
```
Albo otwórz `docs/index.html` w przeglądarce → Ctrl+P → „Zapisz jako PDF”.
