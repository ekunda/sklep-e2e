import { createApp } from "./app.js";
import { SCHEMA_SQL } from "./migrations.js";
import { createDemoPool, createMemoryRedis } from "./demo-db.js";
import { hashPassword } from "./auth.js";

/**
 * DEMO „na żywo" — bez Dockera.
 *
 * Uruchamia tę samą aplikację co `pnpm dev`, ale na PGlite (Postgres w WASM)
 * i cache'u w pamięci. Idealne do prezentacji: `pnpm demo`, otwórz przeglądarkę,
 * klikaj logowanie → koszyk → zamówienie.
 */
async function main() {
  const port = Number(process.env.PORT ?? 3000);

  const pool = await createDemoPool();
  const redis = createMemoryRedis();

  const { app } = await createApp({
    pool,
    redis,
    jwtSecret: "demo-secret",
    nodeEnv: "development",
  });

  // Schemat przez exec() (wiele poleceń naraz — PGlite tego wymaga).
  await pool.exec(SCHEMA_SQL);

  // Seed: konto demo + przykładowe produkty (żeby było co pokazać od razu).
  const hash = await hashPassword("demo1234");
  await pool.query(
    `INSERT INTO users (email, name, password_hash, role)
     VALUES ($1, $2, $3, 'admin')`,
    ["demo@sklep.pl", "Demo Admin", hash],
  );
  await pool.query(
    `INSERT INTO products (name, price, stock) VALUES
       ('Klawiatura mechaniczna', 299.99, 10),
       ('Mysz bezprzewodowa', 129.50, 25),
       ('Monitor 27 cali', 1199.00, 5),
       ('Słuchawki ANC', 449.00, 8)`,
  );

  app.listen(port, () => {
    console.log("");
    console.log("  🛒  DEMO Sklep E2E — tryb bez Dockera (PGlite + cache w pamięci)");
    console.log(`  ➜  http://localhost:${port}/login.html`);
    console.log("  ➜  Login:  demo@sklep.pl  /  demo1234");
    console.log("");
  });
}

main().catch((err) => {
  console.error("Demo nie wystartowało:", err);
  process.exit(1);
});
