import { PGlite } from "@electric-sql/pglite";
import type { Pool } from "pg";
import type { RedisClientType } from "redis";

/**
 * Tryb DEMO bez Dockera.
 *
 * PGlite to prawdziwy PostgreSQL skompilowany do WebAssembly — działa w procesie
 * Node, bez kontenera. Tu opakowujemy go w cienki shim zgodny z interfejsem
 * `pg.Pool` (query / connect / end), żeby aplikacja działała na nim BEZ ZMIAN.
 *
 * To NIE zastępuje Testcontainers w testach — tam chcemy 1:1 produkcyjnego
 * Postgresa. To wyłącznie wygodny tryb prezentacji „na żywo".
 */
/** Pula demo + metoda `exec` do skryptów wielopoleceniowych (schemat). */
export type DemoPool = Pool & { exec: (sql: string) => Promise<unknown> };

export async function createDemoPool(): Promise<DemoPool> {
  const db = new PGlite(); // baza w pamięci — świeża przy każdym starcie
  await db.waitReady;

  const client = {
    query: (text: string, params?: unknown[]) => db.query(text, params as never),
    release: () => {},
  };

  const shim = {
    query: (text: string, params?: unknown[]) => db.query(text, params as never),
    connect: async () => client, // PGlite to jedno połączenie — BEGIN/COMMIT działają
    end: async () => db.close(),
    // PGlite query() = protokół rozszerzony (jedno polecenie). Do wielu poleceń
    // (np. cały schemat naraz) służy exec() = protokół prosty.
    exec: (sql: string) => db.exec(sql),
  };

  return shim as unknown as DemoPool;
}

/**
 * Cache w pamięci zamiast Redisa — implementuje tylko metody, których używa
 * aplikacja (get / set z TTL / del / flushDb). Dla demo w zupełności wystarcza.
 */
export function createMemoryRedis(): RedisClientType {
  const store = new Map<string, { v: string; exp: number }>();

  const shim = {
    on: () => shim,
    connect: async () => {},
    quit: async () => {},
    get: async (k: string) => {
      const e = store.get(k);
      if (!e) return null;
      if (e.exp && e.exp < Date.now()) {
        store.delete(k);
        return null;
      }
      return e.v;
    },
    set: async (k: string, v: string, opts?: { EX?: number }) => {
      store.set(k, { v, exp: opts?.EX ? Date.now() + opts.EX * 1000 : 0 });
      return "OK";
    },
    del: async (k: string) => {
      store.delete(k);
      return 1;
    },
    flushDb: async () => {
      store.clear();
      return "OK";
    },
  };

  return shim as unknown as RedisClientType;
}
