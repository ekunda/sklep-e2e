import { createApp } from "./app.js";
import { runMigrations } from "./migrations.js";

/**
 * Punkt wejścia dla trybu dev/prod (`npm run dev` / `npm start`).
 *
 * Testy NIE używają tego pliku — one tworzą aplikację bezpośrednio przez
 * createApp() ze stringami z Testcontainers. Tu czytamy konfigurację z env.
 */
async function main() {
  const port = Number(process.env.PORT ?? 3000);

  const { app, pool, close } = await createApp({
    databaseUrl: process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/sklep",
    redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379",
    jwtSecret: process.env.JWT_SECRET ?? "dev-secret-change-me",
    nodeEnv: process.env.NODE_ENV ?? "development",
  });

  // Załóż schemat (idempotentne — CREATE TABLE IF NOT EXISTS).
  await runMigrations(pool);

  // W dev wrzuć kilka przykładowych produktów, jeśli baza jest pusta.
  if ((process.env.NODE_ENV ?? "development") === "development") {
    const { rows } = await pool.query("SELECT COUNT(*)::int AS n FROM products");
    if (rows[0].n === 0) {
      await pool.query(
        `INSERT INTO products (name, price, stock) VALUES
           ('Klawiatura mechaniczna', 299.99, 10),
           ('Mysz bezprzewodowa', 129.50, 25),
           ('Monitor 27 cali', 1199.00, 5)`,
      );
    }
  }

  const server = app.listen(port, () => {
    console.log(`Serwer działa na http://localhost:${port}`);
  });

  // Czyste zamknięcie (Ctrl+C).
  const shutdown = async () => {
    server.close();
    await close();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error("Nie udało się wystartować serwera:", err);
  process.exit(1);
});
