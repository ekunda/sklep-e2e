import { Router } from "express";
import type { AppContext } from "../context.js";
import { PRODUCTS_CACHE_KEY } from "../context.js";
import { ah } from "../async-handler.js";

export function productsRoutes(ctx: AppContext): Router {
  const router = Router();

  // Lista produktów — z cache w Redis (30s). Pokazuje realną integrację
  // aplikacja <-> Redis, którą weryfikujemy w testach integracyjnych.
  router.get("/", ah(async (_req, res) => {
    const cached = await ctx.redis.get(PRODUCTS_CACHE_KEY);
    if (cached) {
      res.json({ products: JSON.parse(cached), source: "cache" });
      return;
    }

    const result = await ctx.pool.query(
      `SELECT id, name, price, stock FROM products ORDER BY id`,
    );
    await ctx.redis.set(PRODUCTS_CACHE_KEY, JSON.stringify(result.rows), { EX: 30 });
    res.json({ products: result.rows, source: "db" });
  }));

  router.get("/:id", ah(async (req, res) => {
    const result = await ctx.pool.query(
      `SELECT id, name, price, stock FROM products WHERE id = $1`,
      [req.params.id],
    );
    const product = result.rows[0];
    if (!product) {
      res.status(404).json({ error: "Nie znaleziono produktu" });
      return;
    }
    res.json({ product });
  }));

  return router;
}
