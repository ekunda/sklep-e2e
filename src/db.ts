import pg from "pg";

const { Pool } = pg;

/**
 * Tworzy pulę połączeń do PostgreSQL.
 *
 * W teście `connectionString` pochodzi z kontenera Testcontainers
 * (np. container.getConnectionUri()), w dev/prod z DATABASE_URL.
 */
export function createPool(connectionString: string): pg.Pool {
  return new Pool({ connectionString });
}

export type { Pool } from "pg";
