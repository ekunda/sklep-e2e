import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Testujemy tylko katalog integracyjny (E2E robi Playwright)
    include: ["tests/integration/**/*.test.ts"],

    // globalSetup uruchamia kontenery RAZ dla całego przebiegu i przekazuje
    // connection stringi do testów przez API provide()/inject().
    globalSetup: ["tests/integration/global-setup.ts"],

    // Pliki integracyjne współdzielą JEDEN kontener Postgresa, a każdy test
    // czyści bazę w beforeEach. Gdyby pliki biegły równolegle, czyszczenie
    // w jednym pliku kasowałoby dane drugiego. Dlatego wyłączamy
    // równoległość MIĘDZY plikami (testy w obrębie pliku i tak idą po kolei).
    fileParallelism: false,

    // Start kontenera potrafi trwać kilka sekund (pierwszy raz: pobranie obrazu).
    testTimeout: 30_000,
    hookTimeout: 120_000,
  },
});
