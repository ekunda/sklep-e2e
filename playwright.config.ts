import { defineConfig, devices } from "@playwright/test";

/**
 * Konfiguracja Playwright.
 *
 * Uwaga na kolejność cyklu życia Playwright:
 *   1. wczytanie configu
 *   2. (jeśli ustawiony) webServer
 *   3. globalSetup
 *   4. testy
 *
 * Dlatego NIE używamy `webServer` — serwer aplikacji wymaga DATABASE_URL/REDIS_URL
 * z kontenerów, które startują dopiero w globalSetup. Zamiast tego globalSetup
 * sam uruchamia kontenery, migracje ORAZ serwer aplikacji, a globalTeardown
 * wszystko sprząta. Dzięki temu kolejność jest zawsze poprawna.
 */
export default defineConfig({
  testDir: "./tests/e2e",

  // W całym przebiegu testy mogą iść równolegle (każdy ma świeży kontekst).
  fullyParallel: true,

  // Powtórki tylko w CI — pomagają odróżnić realny błąd od flaky.
  retries: process.env.CI ? 2 : 0,

  // W CI ograniczamy workerów (jedna współdzielona baza); lokalnie więcej.
  workers: process.env.CI ? 2 : undefined,

  reporter: [
    ["html", { open: "never" }],
    ["list"],
  ],

  use: {
    // baseURL musi pasować do portu, na którym globalSetup wystartował serwer.
    baseURL: "http://localhost:3000",

    // Trace: nagrywaj przy pierwszej powtórce nieudanego testu — wtedy masz
    // pełną "czarną skrzynkę" do analizy w Trace Viewerze, bez zalewania dysku.
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  // Kontenery + migracje + serwer aplikacji.
  globalSetup: "./tests/e2e/global-setup.ts",
  globalTeardown: "./tests/e2e/global-teardown.ts",
});
