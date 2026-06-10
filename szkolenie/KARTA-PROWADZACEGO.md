# Karta prowadzącego — Testcontainers + Playwright

Jedna strona do druku (A4). Pełny scenariusz → [`PORADNIK-PROWADZACEGO.md`](PORADNIK-PROWADZACEGO.md).
Repo: `github.com/ekunda/sklep-e2e` · Prezentacja: `ekunda.github.io/sklep-e2e`

---

### Agenda (kolejność)
1. **Po co testy** — mock = rozmowa, Testcontainers = rezultat
2. **Demo sklepu** — `pnpm demo`, login → koszyk → zamówienie → ponad stan (rollback)
3. **Testcontainers + integracja** — `pnpm test:integration`, rollback/UNIQUE
4. **Seed per test** — `seed.ts` + `beforeEach(cleanDatabase)`
5. **Playwright fixtures** — `fixtures.ts`, login przez API
6. **Trace** — `show-trace` (moment „wow”)
7. **Złam i napraw** — patrz niżej
8. **Dobre vs złe + CI** — sharding, anti-flaky
9. **Podsumowanie** — 5 punktów

### Komendy
```
corepack enable && pnpm install
pnpm exec playwright install chromium
pnpm demo                     # sklep bez Dockera (demo@sklep.pl / demo1234)
pnpm test:integration         # Vitest + Testcontainers (Docker)
pnpm test:e2e:headed          # Playwright, widoczna przeglądarka (Docker)
pnpm exec playwright show-trace <trace.zip>
```

### 5 rzeczy do zapamiętania
1. Mock = rozmowa, **Testcontainers = rezultat**.
2. Kontener **raz**, dane czyść **przed każdym testem** (Vitest: `provide`/`inject`).
3. **Seed per test** — nie zakładaj `id = 1`.
4. **Fixtures** — powtarzalny setup + login przez API + teardown.
5. **Trace `on-first-retry`** — czytaj: czerwona akcja → Network → Console.

### Złam i napraw (na żywo)
| # | Co zepsuć | Objaw |
|---|---|---|
| A | nazwa przycisku w `shopping.spec.ts` | test pada na `click`; trace: „0 elementów” |
| B | usuń `NODE_ENV=test` w e2e `global-setup.ts` | fixtures → **403** (seed-user) |
| C | wyłącz `cleanDatabase` w `beforeEach` | testy padają razem (duplikat email) |

**Gotowe gałęzie demo** (otwórz PR do `main`, żeby zobaczyć czerwone CI + trace):
- `broken/selector` — scenariusz A
- `broken/node-env` — scenariusz B

> Bez Dockera? Pokaż `pnpm demo`, zielone CI w Actions i trace z artefaktów.
> Zasada: **pokaż, nie opowiadaj**; jeden „wow” = trace.
