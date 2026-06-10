import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import type { CreatedApp } from "../../src/app.js";
import { createTestApp } from "../helpers/test-app.js";
import { cleanDatabase, cleanRedis } from "../helpers/db-cleaner.js";
import { seedUser } from "../helpers/seed.js";

describe("Auth API (integracja z prawdziwym Postgresem)", () => {
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

  describe("POST /api/auth/register", () => {
    it("rejestruje użytkownika i zwraca token", async () => {
      const res = await request(ctx.app)
        .post("/api/auth/register")
        .send({ email: "nowy@test.com", password: "Secret123!", name: "Nowy" });

      expect(res.status).toBe(201);
      expect(res.body.token).toBeTruthy();
      expect(res.body.user).toMatchObject({ email: "nowy@test.com", name: "Nowy", role: "user" });

      // Realna weryfikacja: użytkownik faktycznie jest w bazie.
      const { rows } = await ctx.pool.query("SELECT email FROM users WHERE email = $1", [
        "nowy@test.com",
      ]);
      expect(rows).toHaveLength(1);
    });

    it("odrzuca zduplikowany email (constraint UNIQUE z bazy)", async () => {
      await seedUser(ctx.pool, { email: "zajety@test.com" });

      const res = await request(ctx.app)
        .post("/api/auth/register")
        .send({ email: "zajety@test.com", password: "Secret123!", name: "Inny" });

      // To jest właśnie wartość Testcontainers: prawdziwa baza wymusza UNIQUE,
      // mock mógłby "skłamać", że zapis się udał.
      expect(res.status).toBe(409);
    });

    it("waliduje brakujące pola", async () => {
      const res = await request(ctx.app).post("/api/auth/register").send({ email: "x@test.com" });
      expect(res.status).toBe(400);
    });
  });

  describe("POST /api/auth/login", () => {
    it("loguje przy poprawnych danych", async () => {
      const user = await seedUser(ctx.pool, { email: "log@test.com", password: "MojeHaslo1!" });

      const res = await request(ctx.app)
        .post("/api/auth/login")
        .send({ email: user.email, password: "MojeHaslo1!" });

      expect(res.status).toBe(200);
      expect(res.body.token).toBeTruthy();
    });

    it("odrzuca złe hasło", async () => {
      const user = await seedUser(ctx.pool, { email: "log2@test.com", password: "MojeHaslo1!" });

      const res = await request(ctx.app)
        .post("/api/auth/login")
        .send({ email: user.email, password: "zle-haslo" });

      expect(res.status).toBe(401);
    });
  });

  describe("GET /api/auth/me", () => {
    it("zwraca profil dla poprawnego tokenu", async () => {
      const user = await seedUser(ctx.pool, { email: "me@test.com", password: "Haslo123!" });
      const login = await request(ctx.app)
        .post("/api/auth/login")
        .send({ email: user.email, password: "Haslo123!" });

      const res = await request(ctx.app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${login.body.token}`);

      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe("me@test.com");
    });

    it("zwraca 401 bez tokenu", async () => {
      const res = await request(ctx.app).get("/api/auth/me");
      expect(res.status).toBe(401);
    });
  });
});
