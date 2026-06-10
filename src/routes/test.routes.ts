import { Router } from "express";
import type { AppContext } from "../context.js";
import { hashPassword, signToken } from "../auth.js";
import { invalidateProductsCache } from "../context.js";
import { ah } from "../async-handler.js";

/**
 * Trasy pomocnicze dla testów: szybki seed i cleanup danych przez HTTP.
 * Używają ich fixtures Playwright, żeby przygotować dane PRZED testem
 * bez klikania po UI.
 *
 * ⚠️ Montowane TYLKO gdy NODE_ENV === 'test'. Dodatkowo strażnik na wejściu
 * blokuje je, gdyby kiedykolwiek trafiły na produkcję.
 */
export function testRoutes(ctx: AppContext): Router {
  const router = Router();

  router.use((_req, res, next) => {
    if (process.env.NODE_ENV !== "test") {
      res.status(403).json({ error: "Trasy testowe są wyłączone poza środowiskiem test" });
      return;
    }
    next();
  });

  // Tworzy użytkownika i od razu zwraca token — gotowy do zalogowania w UI.
  router.post("/seed-user", ah(async (req, res) => {
    const {
      email = `user-${Date.now()}@test.com`,
      password = "TestPass123!",
      name = "Test User",
      role = "user",
    } = req.body ?? {};

    const passwordHash = await hashPassword(password);
    const result = await ctx.pool.query(
      `INSERT INTO users (email, name, password_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, name, role`,
      [email, name, passwordHash, role],
    );
    const user = result.rows[0];
    const token = signToken({ userId: user.id, role: user.role }, ctx.jwtSecret);
    res.status(201).json({ id: user.id, email: user.email, name: user.name, role: user.role, token });
  }));

  router.post("/seed-product", ah(async (req, res) => {
    const { name = "Test Product", price = 29.99, stock = 100 } = req.body ?? {};
    const result = await ctx.pool.query(
      `INSERT INTO products (name, price, stock)
       VALUES ($1, $2, $3)
       RETURNING id, name, price, stock`,
      [name, price, stock],
    );
    await invalidateProductsCache(ctx);
    res.status(201).json(result.rows[0]);
  }));

  router.delete("/cleanup-user/:id", ah(async (req, res) => {
    await ctx.pool.query(`DELETE FROM users WHERE id = $1`, [req.params.id]);
    res.json({ ok: true });
  }));

  router.delete("/cleanup-product/:id", ah(async (req, res) => {
    // Najpierw kasujemy pozycje zamówień wskazujące na produkt (FK), potem produkt.
    // Dzięki temu sprzątanie nie zależy od kolejności teardownu fixtures.
    await ctx.pool.query(`DELETE FROM order_items WHERE product_id = $1`, [req.params.id]);
    await ctx.pool.query(`DELETE FROM products WHERE id = $1`, [req.params.id]);
    await invalidateProductsCache(ctx);
    res.json({ ok: true });
  }));

  // Twardy reset całej bazy — przydatny między dużymi scenariuszami.
  router.post("/reset", ah(async (_req, res) => {
    await ctx.pool.query(
      `TRUNCATE TABLE order_items, orders, products, users RESTART IDENTITY CASCADE`,
    );
    await invalidateProductsCache(ctx);
    res.json({ ok: true });
  }));

  return router;
}
