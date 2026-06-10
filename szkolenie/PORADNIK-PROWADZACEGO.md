# Poradnik prowadzącego

Jak poprowadzić to szkolenie tak, żeby ludzie **zrozumieli i zapamiętali** —
a nie tylko obejrzeli slajdy. Wszystko oparte o repo [`sklep-e2e`](../README.md).

> Repo: https://github.com/ekunda/sklep-e2e · Prezentacja: https://ekunda.github.io/sklep-e2e/

---

## Filozofia w jednym zdaniu
**Pokazuj, nie opowiadaj.** Najpierw uruchom coś na żywo (sklep, test, trace),
potem wytłumacz *dlaczego* tak działa. Ludzie pamiętają to, co zobaczyli i sami spróbowali.

Trzy zasady:
1. **Każdy temat zaczynaj od „po co”** — pokaż problem, zanim pokażesz rozwiązanie.
2. **Jeden „wow” obowiązkowo** — to trace. Zostaw na niego energię.
3. **Nie wchodź w króliczą norę** — pytanie spoza tematu → „świetne, wrócę do tego na końcu”.

---

## Przygotowanie (zrób to przed salą)

```bash
corepack enable
pnpm install
pnpm exec playwright install chromium
# jeśli masz Docker — rozgrzej obrazy, żeby pierwszy test nie czekał na pobieranie:
docker pull postgres:16
docker pull redis:7
```

Miej otwarte i przygotowane:
- **edytor** z repo (zakładki: `tests/e2e/fixtures.ts`, `tests/integration/orders.test.ts`, `tests/helpers/seed.ts`, `playwright.config.ts`),
- **terminal** w katalogu projektu,
- **przeglądarkę** z `pnpm demo` (sklep) i drugą zakładką z **GitHub Actions** (zielony przebieg),
- jeden gotowy **`trace.zip`** z nieudanego testu (na wypadek braku czasu/Dockera).

### 🔌 Plan B: nie masz Dockera
Cała sesja przejdzie bez Dockera, jeśli:
- zamiast `pnpm test:*` pokazujesz **`pnpm demo`** (działa lokalnie na PGlite),
- testy pokazujesz jako **zielone CI** w Actions,
- trace otwierasz z **artefaktów** pobranych z nieudanego przebiegu CI.

---

## Scenariusz — blok po bloku

Kolejność jest celowa: od „po co”, przez narzędzia, do debugowania. Pilnuj tempa,
ale bez sztywnych minut — ważne, żeby każdy blok miał **pokaz + jedno zdanie do zapamiętania**.

### Blok 1 — Po co testy
- **Pokaż:** nic, tylko analogia (śrubka → silnik+skrzynia → jazda A→B).
- **Powiedz:** „Mock mówi *OK*. Prawdziwa baza mówi *NIE* — bo złamałeś `UNIQUE` albo transakcja się nie cofnęła.”
- **Pytanie do sali:** „Kto miał kiedyś *u mnie działa, a na produkcji nie*?”

### Blok 2 — Demo sklepu (hook)
- **Pokaż:** `pnpm demo` → zaloguj się (`demo@sklep.pl` / `demo1234`) → dodaj do koszyka → złóż zamówienie → **zamów ponad stan** (odrzucone).
- **Powiedz:** „To zachowanie zaraz przetestujemy — i to na *prawdziwej* bazie.”

### Blok 3 — Testcontainers + integracja
- **Pokaż:** `pnpm test:integration` (lub zielone CI). Otwórz [`global-setup.ts`](../tests/integration/global-setup.ts) — kontener startuje raz, `provide()` przekazuje URL.
- **Pokaż test rollbacku** w [`orders.test.ts`](../tests/integration/orders.test.ts).
- **Pułapka do wymienienia:** w Vitest `process.env` z setupu nie dociera do testów → `provide`/`inject`.
- **Do zapamiętania:** *kontener raz, dane czyść przed każdym testem.*

### Blok 4 — Seed per test
- **Pokaż:** [`seed.ts`](../tests/helpers/seed.ts) (każdy test sieje swoje dane) + [`db-cleaner.ts`](../tests/helpers/db-cleaner.ts) (`TRUNCATE ... RESTART IDENTITY CASCADE` w `beforeEach`).
- **Hasło z życia:** „nie zakładaj `id = 1`”.

### Blok 5 — Playwright fixtures
- **Pokaż:** [`fixtures.ts`](../tests/e2e/fixtures.ts) — `testUser` (seed + teardown), `authedPage` (token w localStorage = logowanie bez UI).
- **Uruchom:** `pnpm test:e2e:headed` jednego scenariusza (widoczna przeglądarka robi wrażenie).
- **Do zapamiętania:** *powtarzasz setup → fixture; loguj przez API.*

### Blok 6 — Trace (zostaw energię, to „wow”)
- **Pokaż:** `pnpm exec playwright show-trace <trace.zip>`. Najedź na akcje, kliknij czerwoną → **Call/Log → Network → Console**.
- **Powiedz:** „To jest czarna skrzynka testu. Konfiguracja: `trace: on-first-retry`.”

### Blok 7 — Złam i napraw (patrz sekcja niżej)
- **Zrób na żywo** jeden scenariusz z sekcji „Ćwiczenie: złam i napraw”. To spina wszystko.

### Blok 8 — Dobre vs złe testy + CI + podsumowanie
- **Pokaż:** sekcję „Dobre vs złe” (niżej) i zielony pipeline w Actions (sharding).
- **Zamknij:** 5 rzeczy do zapamiętania (slajd końcowy).

---

## Dobre vs złe testy — przykłady z repo

To pokaż na slajdzie i omów. Każda para = ten sam cel, dwa podejścia.

### 1) Selektory
```ts
// ❌ ŹLE — kruche, zależne od stylów/struktury
await page.click(".btn.btn-primary.mt-3");
await page.click("div > div:nth-child(2) > button");

// ✅ DOBRZE — po roli i widocznym tekście (jak w shopping.spec.ts)
await page.getByRole("button", { name: "Dodaj do koszyka" }).click();
await page.getByLabel("Email").fill("demo@sklep.pl");
// gdy trzeba — dedykowane data-testid:
await page.getByTestId(`product-${id}`).click();
```

### 2) Czekanie (auto-wait zamiast sleepów)
```ts
// ❌ ŹLE — sztywny sleep; na wolnym CI nie zdąży, na szybkim marnuje czas
await page.waitForTimeout(2000);
expect(await page.locator(".toast").count()).toBe(1);

// ✅ DOBRZE — web-first assertion czeka sama (do timeoutu)
await expect(page.getByTestId("toast")).toHaveText("Dodano do koszyka");
```

### 3) Izolacja danych
```ts
// ❌ ŹLE — współdzielony email; drugi test pada na UNIQUE
await seedUser(pool, { email: "test@test.com" });

// ✅ DOBRZE — unikalne dane + czysta baza przed każdym testem
beforeEach(async () => { await cleanDatabase(pool); });
const user = await seedUser(pool); // domyślnie generuje unikalny email
```

### 4) Asercje
```ts
// ❌ ŹLE — ręczny odczyt, brak auto-wait, gorszy komunikat błędu
const count = await page.locator(".product-card").count();
expect(count).toBe(4);

// ✅ DOBRZE
await expect(page.locator(".product-card")).toHaveCount(4);
```

### 5) Stan między testami
```ts
// ❌ ŹLE — test B zależy od danych testu A (kolejność!)
it("A tworzy zamówienie", async () => { /* ... */ });
it("B widzi zamówienie z A", async () => { /* pada uruchomione osobno */ });

// ✅ DOBRZE — każdy test buduje swój stan od zera (seed per test)
it("user widzi swoje zamówienie", async () => {
  const user = await seedUser(pool);
  await seedOrder(pool, { userId: user.id });
  // ... asercja ...
});
```

> 🧠 **Reguła:** dobry test jest **deterministyczny** — daje ten sam wynik niezależnie
> od kolejności, prędkości maszyny i innych testów.

---

## Ćwiczenie: złam i napraw 🔧

Najlepsza nauka debugowania. Rób **na żywo** lub jako zadanie. Każdy scenariusz:
*co zepsuć → co zobaczysz → jak zdiagnozować → jak naprawić → czego uczy.*

> **Z Dockerem:** uruchamiasz testy lokalnie (`pnpm test:e2e` / `test:integration`).
> **Bez Dockera:** zrób zmianę na branchu, `git push`, obejrzyj **czerwone CI** i
> pobierz **trace z artefaktów** (`playwright-traces-*`). Tak właśnie złapaliśmy
> dwa prawdziwe bugi w tym repo.

### Scenariusz A — zły selektor (klasyk)
- **Zepsuj:** w [`tests/e2e/shopping.spec.ts`](../tests/e2e/shopping.spec.ts) zmień
  `{ name: "Dodaj do koszyka" }` na `{ name: "Do koszyka" }`.
- **Zobaczysz:** test wisi do timeoutu i pada na `click()`.
- **Diagnoza (trace):** czerwona akcja `click`; w **Log**: „locator resolved to 0 elements”;
  **snapshot** strony pokazuje przycisk z inną nazwą.
- **Napraw:** przywróć poprawną nazwę.
- **Uczy:** test pada *gdzie* (akcja) i *dlaczego* (0 elementów = zła nazwa, nie „wolna strona”).

### Scenariusz B — rozjazd środowiska (prawdziwy bug z tego repo)
- **Zepsuj:** w [`tests/e2e/global-setup.ts`](../tests/e2e/global-setup.ts) usuń linię
  `process.env.NODE_ENV = "test";`.
- **Zobaczysz:** **wszystkie** testy E2E padają w fixture na `expect(res.ok())`.
- **Diagnoza:** odpowiedź `seed-user` to **403** — strażnik tras testowych czyta
  `process.env.NODE_ENV`, którego Playwright (inaczej niż Vitest) sam nie ustawia.
- **Napraw:** dodaj linię z powrotem.
- **Uczy:** dwie warstwy (montowanie vs strażnik) muszą czytać prawdę z **tego samego** źródła.

### Scenariusz C — brak izolacji (flaky na żądanie)
- **Zepsuj:** w [`tests/integration/auth.test.ts`](../tests/integration/auth.test.ts)
  zakomentuj `await cleanDatabase(ctx.pool)` w `beforeEach`.
- **Zobaczysz:** testy przechodzą pojedynczo, ale **padają razem** — np. rejestracja
  na zajęty email (`409`/`23505`).
- **Diagnoza:** błąd duplikatu w bazie; dane z poprzedniego testu „przeciekły”.
- **Napraw:** odkomentuj czyszczenie.
- **Uczy:** brak czyszczenia = testy zależne od kolejności = flaky.

### Gotowe gałęzie demo (nie musisz psuć ręcznie)
W repo są dwie gałęzie z gotową usterką — idealne na pokaz „czerwone CI → trace → fix”:

| Gałąź | Scenariusz | Jak pokazać |
|---|---|---|
| `broken/selector` | A — zły selektor | otwórz **PR do `main`** → CI robi się czerwone → pobierz trace z artefaktów |
| `broken/node-env` | B — brak `NODE_ENV=test` | jw. — wszystkie E2E padają na 403 |

```bash
# podgląd różnicy, którą zobaczą uczestnicy:
git fetch origin
git diff origin/main origin/broken/selector
git diff origin/main origin/broken/node-env
```
Po pokazie: zamknij PR bez merge’a (gałęzie zostają jako materiał). `main` pozostaje zielony.

---

## Najczęstsze pytania uczestników

**„Po co prawdziwa baza, skoro mock jest szybszy?”**
Mock testuje, że *zawołałeś* funkcję. Baza testuje, że *naprawdę zadziała* (typy,
`UNIQUE`, transakcje). Do bazy/cache → kontenery; do zewnętrznych API → mock.

**„Testcontainers nie spowalniają testów?”**
Start kontenera to sekundy — robimy go **raz** na przebieg. Zysk z wierności >> koszt startu.

**„Czemu logowanie przez API, a nie przez formularz?”**
Bo formularz to 2-3 s na każdy test. Logujesz raz, przez API, i wkładasz token.

**„Kiedy włączać trace?”**
W CI: `on-first-retry` — zapis tylko gdy test pada i jest powtarzany. Lokalnie do ostrego
debugu: `--trace on`.

**„Mam flaky test, co robić?”**
Powtórz 10× (`--repeat-each=10`), otwórz trace nieudanego, sprawdź czy to race
(UI przed danymi) albo brak izolacji. Najczęściej to brudne dane.

---

## Troubleshooting prowadzącego

| Objaw | Co zrobić |
|---|---|
| `docker info` błąd / brak Dockera | przejdź na Plan B (demo + CI + trace z artefaktów) |
| pierwszy test długo wisi | to pobieranie obrazu — rozgrzej `docker pull` przed sesją |
| port 3000 zajęty | `pnpm demo` z innym portem: `PORT=3010 pnpm demo` |
| brak przeglądarki Playwright | `pnpm exec playwright install chromium` |
| `pnpm` nieznane | `corepack enable` (idzie z Node ≥ 22.13) |
| chcę pokazać raport | `pnpm exec playwright show-report` |

---

## Checklist prowadzącego

**Przed:**
- [ ] `pnpm install` + `playwright install chromium` zrobione
- [ ] obrazy Dockera pobrane (lub świadomie Plan B)
- [ ] `pnpm demo` działa, otwarte w przeglądarce
- [ ] zakładka z zielonym CI otwarta
- [ ] gotowy `trace.zip` pod ręką

**W trakcie:**
- [ ] każdy blok: pokaz → jedno zdanie do zapamiętania
- [ ] zrobiony 1 scenariusz „złam i napraw” na żywo
- [ ] pokazany trace (obowiązkowy „wow”)

**Po:**
- [ ] link do repo i prezentacji wysłany uczestnikom
- [ ] wskazany [`README.md`](README.md) (4 h) do samodzielnej nauki
