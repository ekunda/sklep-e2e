# Warsztat — wersja prowadzona

Krótka, prowadzona ścieżka (pokaz + zrozumienie). Prowadzący pokazuje na żywo,
uczestnicy mają repo otwarte i „klikają za prowadzącym”. Pełne ćwiczenia i głębokie
omówienie → [`README.md`](README.md). Jak to dobrze poprowadzić →
[`PORADNIK-PROWADZACEGO.md`](PORADNIK-PROWADZACEGO.md).

> **Cel:** zrozumieć *po co* i *jak* testować z prawdziwą bazą (Testcontainers)
> i przez przeglądarkę (Playwright), oraz umieć przeczytać trace.

---

## Przygotowanie prowadzącego
```bash
corepack enable && pnpm install
pnpm exec playwright install chromium
# jeśli masz silnik kontenerów — rozgrzej obrazy:
docker pull postgres:16 && docker pull redis:7
```
Miej otwarte: repo w edytorze, terminal, przeglądarkę (`pnpm demo`), zakładkę
GitHub Actions (zielony przebieg) i jeden gotowy `trace.zip`.

> **Bez Docker Desktop?** Darmowy zamiennik: **Rancher Desktop** (drop-in) lub
> **Podman** → [`DOCKER-ALTERNATYWY.md`](DOCKER-ALTERNATYWY.md).
> **Bez żadnego silnika?** Używasz `pnpm demo`, zielonego CI i trace z artefaktów —
> cała ścieżka przejdzie.

---

## Kolejność bloków

| Blok | Co robi prowadzący | 🔌 Bez Dockera |
|---|---|---|
| **Po co testy** | analogia: mock = rozmowa, Testcontainers = rezultat | — |
| **Demo sklepu** | `pnpm demo` → login → koszyk → zamówienie → zamów ponad stan (rollback) | ścieżka domyślna |
| **Testcontainers + integracja** | `pnpm test:integration`; start kontenera + test rollbacku/UNIQUE | kod + zielone CI |
| **Seed per test** | `seed.ts` + `beforeEach(cleanDatabase)`; „nie zakładaj id=1” | tylko kod |
| **Playwright fixtures** | `fixtures.ts`; `pnpm test:e2e:headed` jednego spec; selektory | CI / nagranie |
| **Trace (moment „wow”)** | `show-trace`: czerwona akcja → Network → Console | trace z artefaktów |
| **Złam i napraw** | zepsuj selektor → test pada → trace → napraw (patrz poradnik) | przez czerwone CI |
| **Skalowanie + anti-flaky** | sharding w `tests.yml` + zielony Actions; 3 zasady | to samo |
| **Podsumowanie** | 5 rzeczy do zapamiętania + link do repo | — |

---

## 🧠 5 rzeczy do zapamiętania (slajd końcowy)
1. **Mock = rozmowa. Testcontainers = rezultat** (prawdziwa baza w kontenerze).
2. **Kontener raz, dane czyść przed każdym testem** (Vitest: `provide`/`inject`).
3. **Seed per test** — każdy test sieje swoje dane; nie zakładaj `id = 1`.
4. **Fixtures** — powtarzalny setup + login przez API + teardown.
5. **Trace `on-first-retry`** — czytaj: czerwona akcja → Network → Console.

---

## Warianty
- **Krótko:** Demo → Testcontainers → Trace → Podsumowanie. To wystarczy na „dlaczego” + „wow”.
- **Pełny hands-on:** [`README.md`](README.md) — 7 modułów z zadaniami.
- **Jak prowadzić:** [`PORADNIK-PROWADZACEGO.md`](PORADNIK-PROWADZACEGO.md) — scenariusz, dobre/złe przykłady, „złam i napraw”, pytania, troubleshooting.

> **Zasada prowadzącego:** pokaż, nie opowiadaj. Cel to zrozumienie i jeden „wow” (trace),
> a nie pokazanie wszystkiego.
