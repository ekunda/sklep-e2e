# Warsztat 60 minut — Testcontainers + Playwright

Wersja **prowadzona** (pokaz + zrozumienie). W godzinę nie da się zrobić głębokiego
hands-on z 7 modułów — więc prowadzący **pokazuje na żywo**, uczestnicy mają repo
otwarte i „klikają za prowadzącym”. Głębokie ćwiczenia → [`README.md`](README.md)
(wersja 4 h, do samodzielnej nauki).

> **Cel godziny:** zrozumieć *po co* i *jak* testować z prawdziwą bazą (Testcontainers)
> i przez przeglądarkę (Playwright), oraz umieć przeczytać trace. Reszta to samodzielna nauka.

---

## Przygotowanie prowadzącego (przed startem)
```bash
corepack enable && pnpm install
pnpm exec playwright install chromium
# jeśli masz Docker — rozgrzej obrazy:
docker pull postgres:16 && docker pull redis:7
```
Miej otwarte: repo w edytorze, terminal, przeglądarkę (`pnpm demo`), zakładkę
GitHub Actions (zielony przebieg) i jeden gotowy `trace.zip`.

> **Bez Dockera?** Każdy blok ma ścieżkę awaryjną „🔌 bez Dockera” — używasz
> `pnpm demo`, zielonego CI i trace z artefaktów. Cała godzina przejdzie.

---

## Agenda (60 min)

| Czas | Blok | Co robi prowadzący | 🔌 Bez Dockera |
|---|---|---|---|
| 0–4 | **Po co testy** | 1 analogia: mock = rozmowa, Testcontainers = rezultat | — |
| 4–11 | **Demo sklepu** | `pnpm demo` → login → koszyk → zamówienie → zamów ponad stan (rollback) | to jest ścieżka domyślna |
| 11–23 | **Testcontainers + integracja** | `pnpm test:integration`; pokaż start kontenera i test rollbacku/UNIQUE | pokaż kod + zielone CI |
| 23–32 | **Seed per test** | `seed.ts` + `beforeEach(cleanDatabase)`; „nie zakładaj id=1” | tylko kod |
| 32–44 | **Playwright fixtures** | `fixtures.ts`; `pnpm test:e2e:headed` jednego spec; selektory | `pnpm test:e2e` w CI / nagranie |
| 44–52 | **Trace (moment „wow”)** | `show-trace` nieudanego testu: czerwona akcja → Network → Console | trace z artefaktów Actions |
| 52–58 | **Skalowanie + anti-flaky** | pokaż sharding w `tests.yml` + zielony Actions; 3 zasady anti-flaky | to samo |
| 58–60 | **Podsumowanie** | 5 rzeczy do zapamiętania + link do repo | — |

---

## Szczegóły bloków

### 0–4 · Po co (4 min)
Jedno zdanie + analogia samochodu (śrubka → silnik+skrzynia → jazda A→B).
**Mock mówi „OK”. Prawdziwa baza mówi „NIE”** — bo złamałeś `UNIQUE` albo
transakcja się nie cofnęła. Tego mock nie wyłapie.

### 4–11 · Demo sklepu (7 min) — *hook*
```bash
pnpm demo   # ➜ http://localhost:3000/login.html  ·  demo@sklep.pl / demo1234
```
Kliknij: zaloguj → dodaj do koszyka → złóż zamówienie (stan spada) →
zamów **ponad stan** → odrzucone. Powiedz: *„to zachowanie zaraz przetestujemy”.*

### 11–23 · Testcontainers + integracja (12 min)
```bash
pnpm test:integration
```
Pokaż w [`tests/integration/global-setup.ts`](../tests/integration/global-setup.ts):
kontener Postgres + Redis startuje **raz**, `provide()` przekazuje URL.
Otwórz [`tests/integration/orders.test.ts`](../tests/integration/orders.test.ts) —
test, który sprawdza **rollback** i **UNIQUE**. Jedno zdanie o pułapce:
*„w Vitest `process.env` z setupu nie dociera do testów — stąd `provide`/`inject`”.*

### 23–32 · Seed per test (9 min)
[`tests/helpers/seed.ts`](../tests/helpers/seed.ts) (każdy test sieje swoje dane,
helper zwraca id + hasło) i [`db-cleaner.ts`](../tests/helpers/db-cleaner.ts)
(`TRUNCATE ... RESTART IDENTITY CASCADE` w `beforeEach`). Hasło z życia:
*„nie zakładaj `id = 1` — sekwencje nie resetują się między testami”.*

### 32–44 · Playwright fixtures (12 min)
[`tests/e2e/fixtures.ts`](../tests/e2e/fixtures.ts): `testUser` (seed przez API +
teardown), `authedPage` (token w localStorage = logowanie bez UI).
```bash
pnpm test:e2e:headed   # pokaż jeden scenariusz w widocznej przeglądarce
```
Zwróć uwagę na selektory: `getByRole`, `getByLabel`, `data-testid` — stabilne.

### 44–52 · Trace — *moment „wow”* (8 min)
```bash
pnpm exec playwright show-trace ścieżka/do/trace.zip
```
Pokaż timeline, najedź na akcje (screenshoty), kliknij **czerwoną akcję** →
**Call/Log** (dlaczego), **Network** (backend czy UI), **Console** (JS).
Powiedz: *„konfiguracja: `trace: on-first-retry` — zapis tylko gdy trzeba”.*

### 52–58 · Skalowanie + anti-flaky (6 min)
[`tests.yml`](../.github/workflows/tests.yml): sharding `--shard=i/2`, Docker
preinstalowany, artefakty. Pokaż zielony przebieg w Actions. Trzy zasady:
1. zero `waitForTimeout` — web-first assertions (`toBeVisible`, `toHaveCount`),
2. czysta baza / unikalne dane (izolacja),
3. mockuj tylko **zewnętrzne** API.

### 58–60 · Podsumowanie (2 min)
Pokaż listę „do zapamiętania” poniżej i link do repo do samodzielnej nauki.

---

## 🧠 5 rzeczy do zapamiętania (slajd końcowy)
1. **Mock = rozmowa. Testcontainers = rezultat** (prawdziwa baza w kontenerze).
2. **Kontener raz, dane czyść przed każdym testem** (Vitest: `provide`/`inject`).
3. **Seed per test** — każdy test sieje swoje dane; nie zakładaj `id = 1`.
4. **Fixtures** — powtarzalny setup + login przez API + teardown.
5. **Trace `on-first-retry`** — czytaj: czerwona akcja → Network → Console.

---

## Warianty czasowe
- **Masz 90 min?** Dołóż 1 mini-ćwiczenie po bloku fixtures: „dodaj `adminPage`”.
- **Masz 30 min?** Zostaw bloki: Demo (7) → Testcontainers (10) → Trace (8) →
  Podsumowanie (5). To wystarczy na „dlaczego” + „wow”.
- **Pełny hands-on (4 h)?** [`README.md`](README.md) — 7 modułów z zadaniami.

> **Zasada prowadzącego:** pilnuj zegara, nie wchodź w króliczą norę. Cel godziny to
> zrozumienie i jeden „wow” (trace), a nie pokazanie wszystkiego.
