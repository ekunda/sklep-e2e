import type { Pool } from "pg";
import type { RedisClientType } from "redis";

/**
 * Wspólny kontekst wstrzykiwany do tras. Dzięki temu trasy nie sięgają
 * po globalne singletony — łatwo je testować i uruchamiać na innej bazie.
 */
export interface AppContext {
  pool: Pool;
  redis: RedisClientType;
  jwtSecret: string;
}

export const PRODUCTS_CACHE_KEY = "products:all";

/** Unieważnia cache listy produktów (po każdej zmianie produktów/stanu). */
export async function invalidateProductsCache(ctx: AppContext): Promise<void> {
  await ctx.redis.del(PRODUCTS_CACHE_KEY);
}
