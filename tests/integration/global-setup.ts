import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { GenericContainer, type StartedTestContainer } from "testcontainers";
import { createPool } from "../../src/db.js";
import { runMigrations } from "../../src/migrations.js";
import type { GlobalSetupContext } from "vitest/node";

/**
 * Rozszerzamy typ przekazywanych wartości, żeby inject() było typowane.
 * W testach: const url = inject("databaseUrl").
 */
declare module "vitest" {
  export interface ProvidedContext {
    databaseUrl: string;
    redisUrl: string;
  }
}

let pgContainer: StartedPostgreSqlContainer;
let redisContainer: StartedTestContainer;

/**
 * Uruchamiany RAZ przed całym przebiegiem `vitest run`.
 * Startuje Postgres + Redis, zakłada schemat i udostępnia connection stringi.
 */
export default async function setup({ provide }: GlobalSetupContext) {
  // Kontenery startują równolegle — szybciej.
  [pgContainer, redisContainer] = await Promise.all([
    new PostgreSqlContainer("postgres:16")
      .withDatabase("testdb")
      .withUsername("test")
      .withPassword("test")
      .start(),
    new GenericContainer("redis:7").withExposedPorts(6379).start(),
  ]);

  const databaseUrl = pgContainer.getConnectionUri();
  const redisUrl = `redis://${redisContainer.getHost()}:${redisContainer.getMappedPort(6379)}`;

  // Załóż schemat na świeżej bazie.
  const pool = createPool(databaseUrl);
  await runMigrations(pool);
  await pool.end();

  // Udostępnij wartości testom (NIE przez process.env — w Vitest to nie zadziała).
  provide("databaseUrl", databaseUrl);
  provide("redisUrl", redisUrl);

  // Zwracana funkcja to teardown — wywoła się po wszystkich testach.
  return async () => {
    await Promise.all([pgContainer?.stop(), redisContainer?.stop()]);
  };
}
