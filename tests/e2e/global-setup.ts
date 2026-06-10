import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { GenericContainer, type StartedTestContainer } from "testcontainers";
import type { Server } from "node:http";
import { createApp, type CreatedApp } from "../../src/app.js";
import { runMigrations } from "../../src/migrations.js";

/** Stan przekazywany do global-teardown przez globalThis. */
export interface E2EState {
  pgContainer: StartedPostgreSqlContainer;
  redisContainer: StartedTestContainer;
  server: Server;
  created: CreatedApp;
}

export const E2E_PORT = 3000;

/**
 * Uruchamiany RAZ przed wszystkimi testami E2E.
 *
 * Dlaczego tutaj startujemy też serwer (zamiast `webServer` w configu)?
 * Bo `webServer` startuje ZANIM odpali się globalSetup, a serwer potrzebuje
 * URL-i z kontenerów. Tu mamy gwarancję kolejności: kontenery -> migracje -> serwer.
 */
async function globalSetup() {
  console.log("[e2e] startuję kontenery (Postgres + Redis)...");
  const [pgContainer, redisContainer] = await Promise.all([
    new PostgreSqlContainer("postgres:16").start(),
    new GenericContainer("redis:7").withExposedPorts(6379).start(),
  ]);

  const databaseUrl = pgContainer.getConnectionUri();
  const redisUrl = `redis://${redisContainer.getHost()}:${redisContainer.getMappedPort(6379)}`;

  console.log("[e2e] zakładam schemat bazy...");
  const created = await createApp({
    databaseUrl,
    redisUrl,
    jwtSecret: "e2e-secret",
    nodeEnv: "test", // włącza trasy /api/test/* używane przez fixtures
  });
  await runMigrations(created.pool);

  console.log(`[e2e] startuję serwer na :${E2E_PORT}...`);
  const server = await new Promise<Server>((resolve) => {
    const s = created.app.listen(E2E_PORT, () => resolve(s));
  });

  const state: E2EState = { pgContainer, redisContainer, server, created };
  (globalThis as unknown as { __E2E__: E2EState }).__E2E__ = state;

  console.log("[e2e] gotowe.");
}

export default globalSetup;
