import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import type { CreatedApp } from "../../src/app.js";
import { createTestApp, TEST_JWT_SECRET } from "../helpers/test-app.js";
import { cleanDatabase, cleanRedis } from "../helpers/db-cleaner.js";
import { seedUser, seedProduct } from "../helpers/seed.js";
import { signToken } from "../../src/auth.js";

describe("Orders & Products API (Postgres + Redis)", () => {
  let ctx: CreatedApp;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.close();
  });

  beforeEach(async () => {
    await cleanDatabase(ctx.pool);
    await cleanRedis(ctx.redis);
  });

  /** Pomocniczo: token dla zaseedowanego usera. */
  function tokenFor(userId: number, role = "user") {
    return signToken({ userId, role }, TEST_JWT_SECRET);
  }

  describe("POST /api/orders", () => {
    it("składa zamówienie i zmniejsza stan magazynu (transakcja)", async () => {
      const user = await seedUser(ctx.pool);
      const product = await seedProduct(ctx.pool, { name: "Laptop", price: 2999.99, stock: 5 });

      const res = await request(ctx.app)
        .post("/api/orders")
        .set("Authorization", `Bearer ${tokenFor(user.id)}`)
        .send({ items: [{ productId: product.id, quantity: 2 }] });

      expect(res.status).toBe(201);
      expect(res.body.order.status).toBe("pending");
      expect(res.body.order.total).toBe("5999.98");
      expect(res.body.order.items).toHaveLength(1);

      // Stan magazynu realnie zmniejszony w bazie: 5 - 2 = 3.
      const { rows } = await ctx.pool.query("SELECT stock FROM products WHERE id = $1", [
        product.id,
      ]);
      expect(rows[0].stock).toBe(3);
    });

    it("odrzuca zamówienie ponad stan i NIE zmienia magazynu (rollback)", async () => {
      const user = await seedUser(ctx.pool);
      const product = await seedProduct(ctx.pool, { stock: 2 });

      const res = await request(ctx.app)
        .post("/api/orders")
        .set("Authorization", `Bearer ${tokenFor(user.id)}`)
        .send({ items: [{ productId: product.id, quantity: 10 }] });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/stock/i);

      // Po rollbacku stan musi zostać nietknięty.
      const { rows } = await ctx.pool.query("SELECT stock FROM products WHERE id = $1", [
        product.id,
      ]);
      expect(rows[0].stock).toBe(2);
    });

    it("wycofuje CAŁE zamówienie, gdy choć jedna pozycja jest niedostępna", async () => {
      const user = await seedUser(ctx.pool);
      const ok = await seedProduct(ctx.pool, { name: "Dostępny", stock: 10 });
      const low = await seedProduct(ctx.pool, { name: "Brakuje", stock: 1 });

      const res = await request(ctx.app)
        .post("/api/orders")
        .set("Authorization", `Bearer ${tokenFor(user.id)}`)
        .send({
          items: [
            { productId: ok.id, quantity: 3 },
            { productId: low.id, quantity: 5 },
          ],
        });

      expect(res.status).toBe(400);

      // Atomowość: skoro całość się nie udała, stan "Dostępnego" też nietknięty.
      const { rows } = await ctx.pool.query("SELECT stock FROM products WHERE id = $1", [ok.id]);
      expect(rows[0].stock).toBe(10);
    });

    it("wymaga zalogowania (401 bez tokenu)", async () => {
      const product = await seedProduct(ctx.pool);
      const res = await request(ctx.app)
        .post("/api/orders")
        .send({ items: [{ productId: product.id, quantity: 1 }] });
      expect(res.status).toBe(401);
    });
  });

  describe("GET /api/orders", () => {
    it("zwraca historię zamówień użytkownika", async () => {
      const user = await seedUser(ctx.pool);
      const product = await seedProduct(ctx.pool, { stock: 100 });
      const token = tokenFor(user.id);

      await request(ctx.app)
        .post("/api/orders")
        .set("Authorization", `Bearer ${token}`)
        .send({ items: [{ productId: product.id, quantity: 1 }] });

      const res = await request(ctx.app).get("/api/orders").set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.orders).toHaveLength(1);
    });
  });

  describe("GET /api/products — cache w Redis", () => {
    it("pierwsze zapytanie z bazy, kolejne z cache", async () => {
      await seedProduct(ctx.pool, { name: "Cache-test" });

      const first = await request(ctx.app).get("/api/products");
      expect(first.body.source).toBe("db");

      const second = await request(ctx.app).get("/api/products");
      expect(second.body.source).toBe("cache");
    });

    it("dodanie produktu przez /api/test/seed-product unieważnia cache", async () => {
      await request(ctx.app).get("/api/products"); // wypełnij cache (pusta lista)

      // Seed przez trasę testową — powinna wyczyścić cache.
      await request(ctx.app)
        .post("/api/test/seed-product")
        .send({ name: "Nowość", price: 10, stock: 1 });

      const res = await request(ctx.app).get("/api/products");
      expect(res.body.source).toBe("db");
      expect(res.body.products).toHaveLength(1);
    });
  });
});
