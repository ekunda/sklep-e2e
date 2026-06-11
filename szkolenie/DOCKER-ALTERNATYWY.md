# Darmowe alternatywy dla Docker Desktop

Testcontainers **nie potrzebuje „Dockera od Docker Inc.”** — potrzebuje dowolnego
silnika zgodnego z Docker API. Docker Desktop na Windows/macOS wymaga płatnej
licencji w firmach 250+ pracowników lub $10M+ przychodu. Poniżej dwie w pełni
darmowe alternatywy (także komercyjnie) + plan awaryjny bez żadnego silnika.

## 🚦 TL;DR — którą drogę wybrać?

| Droga | Koszt | Konfiguracja pod Testcontainers | Dla kogo |
|---|---|---|---|
| 🐮 **Rancher Desktop** (zalecane) | darmowy, open source (Apache-2.0) | **zero** — działa jak Docker | „podmień i zapomnij” |
| 🦭 **Podman Desktop** | darmowy, open source (Apache-2.0) | 2 zmienne środowiskowe | polityka firmy / znasz Podmana / WSL2 nie działa |
| 🔌 **Bez silnika** | — | nie dotyczy | `pnpm demo` + zielone CI + trace z artefaktów |

---

## 🐮 Rancher Desktop — drop-in replacement

1. Zainstaluj z [rancherdesktop.io](https://rancherdesktop.io/).
2. W **Preferences → Container Engine** wybierz **dockerd (moby)** — nie containerd.
   Testcontainers wymaga Docker API, a daje je tylko dockerd.
3. (Opcjonalnie) wyłącz Kubernetes w Preferences — na szkoleniu go nie używamy,
   a start będzie szybszy.
4. Sprawdź: `docker info` — Rancher dostarcza własne CLI `docker` i wystawia
   standardowy named pipe, więc **wszystkie komendy z tego szkolenia działają bez zmian**:

```bash
docker pull postgres:16 && docker pull redis:7   # rozgrzewka obrazów
pnpm test:integration                            # Testcontainers — zero konfiguracji
```

Gdyby Testcontainers nie znalazł silnika (np. masz pozostałości po Docker Desktop):

```powershell
$env:DOCKER_HOST = "npipe:////./pipe/docker_engine"
```

> Na Windows Rancher Desktop działa na **WSL2** (jak Docker Desktop). Jeśli WSL2
> u Ciebie nie działa → patrz Podman + Hyper-V niżej.

---

## 🦭 Podman Desktop

1. Zainstaluj z [podman-desktop.io](https://podman-desktop.io/) i uruchom —
   kreator założy i wystartuje maszynę (`podman machine`).
2. Wskaż Testcontainers gniazdo Podmana (PowerShell):

```powershell
$pipe = (podman machine inspect --format '{{.ConnectionInfo.PodmanPipe.Path}}') -replace '\\','/'
$env:DOCKER_HOST = "npipe://$pipe"
$env:TESTCONTAINERS_RYUK_DISABLED = "true"
```

Na Linux/macOS:

```bash
export DOCKER_HOST=unix://$(podman info --format '{{.Host.RemoteSocket.Path}}')
export TESTCONTAINERS_RYUK_DISABLED=true
```

3. Sprawdź: `podman info`, potem `pnpm test:integration`.

> **Czemu wyłączamy Ryuk?** Ryuk to kontener-sprzątacz Testcontainers; wymaga
> uprawnień, których rootless Podman nie daje. Konsekwencja: po **przerwanych**
> (Ctrl+C) testach kontenery mogą zostać — sprzątasz ręcznie:
> `podman ps -a` → `podman rm -f <id>`. Po normalnym przebiegu global-setup
> zatrzymuje kontenery sam.

### 💡 WSL2 nie działa? Podman umie Hyper-V

Prawdziwy przypadek z tego projektu: konflikt WSL2 z Memory Integrity (HVCI)
zablokował Dockera lokalnie. Podman 5+ potrafi uruchomić maszynę na **Hyper-V**
zamiast WSL2:

```powershell
$env:CONTAINERS_MACHINE_PROVIDER = "hyperv"
podman machine init
podman machine start
```

Wymaga włączonej roli Hyper-V (Windows Pro/Enterprise). Jeśli i to nie wchodzi
w grę → Plan B niżej.

---

## 🔌 Plan B — zero silnika kontenerów

Całe szkolenie przejdziesz bez kontenerów na maszynie:

- **Sklep na żywo:** `pnpm demo` — ta sama aplikacja na PGlite (Postgres w WASM).
- **Testy:** zielony pipeline w GitHub Actions — CI ma Dockera preinstalowanego.
- **Trace:** pobierz `trace.zip` z artefaktów nieudanego przebiegu CI.

Szczegóły prowadzenia w tym trybie → [PORADNIK-PROWADZACEGO.md](PORADNIK-PROWADZACEGO.md)
(sekcja „Plan B”).

---

## ✅ Checklist przed szkoleniem (dowolny silnik)

```bash
docker info        # Rancher (lub: podman info)
docker pull postgres:16 && docker pull redis:7
pnpm test:integration   # pierwszy raz może pobierać obrazy — to normalne
```

> 🧠 **Do zapamiętania:** Testcontainers gada z **Docker API**, nie z konkretną
> firmą. Rancher Desktop = zero zmian. Podman = `DOCKER_HOST` + wyłączony Ryuk.
> Brak silnika = demo + CI.
