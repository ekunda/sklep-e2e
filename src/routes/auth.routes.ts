import { Router } from "express";
import type { AppContext } from "../context.js";
import { authMiddleware, hashPassword, signToken, verifyPassword } from "../auth.js";
import { ah } from "../async-handler.js";

export function authRoutes(ctx: AppContext): Router {
  const router = Router();

  // Rejestracja nowego użytkownika.
  router.post("/register", ah(async (req, res) => {
    const { email, password, name } = req.body ?? {};
    if (!email || !password || !name) {
      res.status(400).json({ error: "Wymagane: email, password, name" });
      return;
    }

    const passwordHash = await hashPassword(password);
    try {
      const result = await ctx.pool.query(
        `INSERT INTO users (email, name, password_hash)
         VALUES ($1, $2, $3)
         RETURNING id, email, name, role`,
        [email, name, passwordHash],
      );
      const user = result.rows[0];
      const token = signToken({ userId: user.id, role: user.role }, ctx.jwtSecret);
      res.status(201).json({ token, user });
    } catch (err: any) {
      // 23505 = unique_violation (zduplikowany email)
      if (err?.code === "23505") {
        res.status(409).json({ error: "Email jest już zajęty" });
        return;
      }
      throw err;
    }
  }));

  // Logowanie — zwraca token JWT.
  router.post("/login", ah(async (req, res) => {
    const { email, password } = req.body ?? {};
    if (!email || !password) {
      res.status(400).json({ error: "Wymagane: email, password" });
      return;
    }

    const result = await ctx.pool.query(
      `SELECT id, email, name, role, password_hash FROM users WHERE email = $1`,
      [email],
    );
    const user = result.rows[0];
    if (!user || !(await verifyPassword(password, user.password_hash))) {
      res.status(401).json({ error: "Nieprawidłowy email lub hasło" });
      return;
    }

    const token = signToken({ userId: user.id, role: user.role }, ctx.jwtSecret);
    res.json({
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    });
  }));

  // Dane zalogowanego użytkownika.
  router.get("/me", authMiddleware(ctx.jwtSecret), ah(async (req, res) => {
    const result = await ctx.pool.query(
      `SELECT id, email, name, role FROM users WHERE id = $1`,
      [req.auth!.userId],
    );
    const user = result.rows[0];
    if (!user) {
      res.status(404).json({ error: "Nie znaleziono użytkownika" });
      return;
    }
    res.json({ user });
  }));

  return router;
}
