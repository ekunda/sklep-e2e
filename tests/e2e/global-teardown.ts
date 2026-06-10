import type { E2EState } from "./global-setup.js";

/** Sprząta po wszystkich testach: serwer, połączenia, kontenery. */
async function globalTeardown() {
  const state = (globalThis as unknown as { __E2E__?: E2EState }).__E2E__;
  if (!state) return;

  await new Promise<void>((resolve) => state.server.close(() => resolve()));
  await state.created.close();
  await Promise.all([state.pgContainer.stop(), state.redisContainer.stop()]);
  console.log("[e2e] posprzątane.");
}

export default globalTeardown;
