import { Router } from "express";
import type { AppContext } from "../context.js";
import { authMiddleware } from "../auth.js";
import { invalidateProductsCache } from "../context.js";
import { ah } from "../async-handler.js";

interface OrderItemInput {
  productId: number;
  quantity: number;
}

export function ordersRoutes(ctx: AppContext): Router {
  const router = Router();

  // Wszystkie trasy zamówień wymagają zalogowania.
  router.use(authMiddleware(ctx.jwtSecret));

  // Złożenie zamówienia. Cała operacja w transakcji:
  // blokujemy wiersze produktów (FOR UPDATE), sprawdzamy stan,
  // zmniejszamy go i zapisujemy zamówienie. Jak czegokolwiek brakuje — ROLLBACK.
  router.post("/", ah(async (req, res) => {
    const userId = req.auth!.userId;
    const items: OrderItemInput[] = req.body?.items ?? [];

    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: "Zamówienie musi zawierać co najmniej jedną pozycję" });
      return;
    }

    const client = await ctx.pool.connect();
    try {
      await client.query("BEGIN");

      let total = 0;
      const resolvedItems: { productId: number; quantity: number; unitPrice: number }[] = [];

      for (const item of items) {
        const productRes = await client.query(
          `SELECT id, name, price, stock FROM products WHERE id = $1 FOR UPDATE`,
          [item.productId],
        );
        const product = productRes.rows[0];

        if (!product) {
          await client.query("ROLLBACK");
          res.status(404).json({ error: `Produkt ${item.productId} nie istnieje` });
          return;
        }
        if (item.quantity <= 0) {
          await client.query("ROLLBACK");
          res.status(400).json({ error: "Ilość musi być dodatnia" });
          return;
        }
        if (product.stock < item.quantity) {
          await client.query("ROLLBACK");
          res.status(400).json({
            error: `Niewystarczający stock dla "${product.name}" (dostępne: ${product.stock})`,
          });
          return;
        }

        await client.query(`UPDATE products SET stock = stock - $1 WHERE id = $2`, [
          item.quantity,
          product.id,
        ]);

        const unitPrice = Number(product.price);
        total += unitPrice * item.quantity;
        resolvedItems.push({ productId: product.id, quantity: item.quantity, unitPrice });
      }

      const orderRes = await client.query(
        `INSERT INTO orders (user_id, status, total)
         VALUES ($1, 'pending', $2)
         RETURNING id, status, total, created_at`,
        [userId, total.toFixed(2)],
      );
      const order = orderRes.rows[0];

      for (const ri of resolvedItems) {
        await client.query(
          `INSERT INTO order_items (order_id, product_id, quantity, unit_price)
           VALUES ($1, $2, $3, $4)`,
          [order.id, ri.productId, ri.quantity, ri.unitPrice.toFixed(2)],
        );
      }

      await client.query("COMMIT");

      // Stan magazynu się zmienił — czyścimy cache produktów.
      await invalidateProductsCache(ctx);

      res.status(201).json({
        order: {
          id: order.id,
          status: order.status,
          total: order.total,
          items: resolvedItems.map((ri) => ({
            productId: ri.productId,
            quantity: ri.quantity,
            unitPrice: ri.unitPrice.toFixed(2),
          })),
        },
      });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }));

  // Historia zamówień zalogowanego użytkownika.
  router.get("/", ah(async (req, res) => {
    const result = await ctx.pool.query(
      `SELECT id, status, total, created_at
       FROM orders WHERE user_id = $1 ORDER BY id DESC`,
      [req.auth!.userId],
    );
    res.json({ orders: result.rows });
  }));

  // Szczegóły jednego zamówienia (wraz z pozycjami).
  router.get("/:id", ah(async (req, res) => {
    const orderRes = await ctx.pool.query(
      `SELECT id, status, total, created_at FROM orders WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.auth!.userId],
    );
    const order = orderRes.rows[0];
    if (!order) {
      res.status(404).json({ error: "Nie znaleziono zamówienia" });
      return;
    }

    const itemsRes = await ctx.pool.query(
      `SELECT oi.product_id, oi.quantity, oi.unit_price, p.name
       FROM order_items oi JOIN products p ON p.id = oi.product_id
       WHERE oi.order_id = $1`,
      [order.id],
    );
    res.json({ order: { ...order, items: itemsRes.rows } });
  }));

  return router;
}
