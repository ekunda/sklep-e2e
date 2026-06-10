import express, { type Express } from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createPool, type Pool } from "./db.js";
import { createRedis, type RedisClientType } from "./redis.js";
import type { AppContext } from "./context.js";
import { authRoutes } from "./routes/auth.routes.js";
import { productsRoutes } from "./routes/products.routes.js";
import { ordersRoutes } from "./routes/orders.routes.js";
import { testRoutes } from "./routes/test.routes.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface CreateAppConfig {
  /** Wymagane, chyba że podasz gotowy `pool` (np. PGlite w trybie demo). */
  databaseUrl?: string;
  /** Wymagane, chyba że podasz gotowy `redis` (np. cache w pamięci). */
  redisUrl?: string;
  jwtSecret: string;
  /** Gdy 'test', montowane są trasy /api/test/* (seed, cleanup). */
  nodeEnv?: string;
  /** Gotowa instancja puli (pomija tworzenie z databaseUrl). */
  pool?: Pool;
  /** Gotowa instancja Redisa (pomija tworzenie z redisUrl). */
  redis?: RedisClientType;
}

export interface CreatedApp {
  app: Express;
  pool: Pool;
  redis: RedisClientType;
  /** Zamyka połączenia z bazą i Redisem. */
  close: () => Promise<void>;
}

/**
 * Buduje aplikację Express ze wstrzykniętą konfiguracją.
 *
 * Kluczowy wzorzec testowalności: NIE czytamy globalnych singletonów ani
 * process.env wewnątrz aplikacji — wszystko (URL bazy, Redis, sekret)
 * przychodzi z zewnątrz. Dzięki temu test podaje URL-e z Testcontainers.
 */
export async function createApp(config: CreateAppConfig): Promise<CreatedApp> {
  // Użyj wstrzykniętych instancji (tryb demo) albo zbuduj z URL-i (test/dev/prod).
  const pool = config.pool ?? createPool(config.databaseUrl!);
  const redis = config.redis ?? (await createRedis(config.redisUrl!));

  const ctx: AppContext = { pool, redis, jwtSecret: config.jwtSecret };

  const app = express();
  app.use(express.json());

  // API
  app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
  app.use("/api/auth", authRoutes(ctx));
  app.use("/api/products", productsRoutes(ctx));
  app.use("/api/orders", ordersRoutes(ctx));

  // Trasy testowe montujemy tylko w środowisku testowym.
  if ((config.nodeEnv ?? process.env.NODE_ENV) === "test") {
    app.use("/api/test", testRoutes(ctx));
  }

  // Frontend (statyczne pliki HTML/JS/CSS) — to po nim klika Playwright.
  app.use(express.static(path.join(__dirname, "public")));

  // Centralna obsługa błędów — żeby nieobsłużony wyjątek dał 500, a nie zawisł.
  app.use(
    (err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      console.error("[app] unhandled error:", err);
      res.status(500).json({ error: "Wewnętrzny błąd serwera" });
    },
  );

  const close = async () => {
    await pool.end();
    await redis.quit();
  };

  return { app, pool, redis, close };
}
