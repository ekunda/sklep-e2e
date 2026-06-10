import type { Pool } from "pg";
import type { RedisClientType } from "redis";

/**
 * Czyści wszystkie tabele aplikacji. Wywoływane w beforeEach, żeby każdy test
 * startował z czystą bazą (izolacja przy współdzielonym kontenerze).
 *
 * TRUNCATE ... RESTART IDENTITY CASCADE:
 *  - szybsze niż DELETE,
 *  - resetuje sekwencje (id znów od 1),
 *  - CASCADE ogarnia klucze obce.
 */
export async function cleanDatabase(pool: Pool): Promise<void> {
  await pool.query(
    `TRUNCATE TABLE order_items, orders, products, users RESTART IDENTITY CASCADE`,
  );
}

/** Czyści cache Redis, żeby stare wartości nie przeciekały między testami. */
export async function cleanRedis(redis: RedisClientType): Promise<void> {
  await redis.flushDb();
}
