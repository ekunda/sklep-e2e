import type { Pool } from "pg";
import { hashPassword } from "../../src/auth.js";

/**
 * Seed helpers — "zasiew" danych potrzebnych do konkretnego testu.
 *
 * Zasada: każdy test seeduje WŁASNE dane (seed per test), a helper zwraca
 * to, co będzie potrzebne w asercjach (id, email, hasło plain-text do logowania).
 * Dzięki sensownym wartościom domyślnym podajesz tylko to, co istotne dla testu.
 */

export interface SeedUserOptions {
  email?: string;
  name?: string;
  password?: string;
  role?: "user" | "admin";
}

export interface SeededUser {
  id: number;
  email: string;
  name: string;
  role: string;
  /** Hasło w plain-text — przydatne do późniejszego logowania w teście. */
  password: string;
}

let userCounter = 0;

export async function seedUser(pool: Pool, options: SeedUserOptions = {}): Promise<SeededUser> {
  const opts = {
    email: options.email ?? `user-${++userCounter}-${Date.now()}@test.com`,
    name: options.name ?? "Test User",
    password: options.password ?? "Password123!",
    role: options.role ?? "user",
  };

  const passwordHash = await hashPassword(opts.password);
  const result = await pool.query(
    `INSERT INTO users (email, name, password_hash, role)
     VALUES ($1, $2, $3, $4)
     RETURNING id, email, name, role`,
    [opts.email, opts.name, passwordHash, opts.role],
  );

  return { ...result.rows[0], password: opts.password };
}

export interface SeedProductOptions {
  name?: string;
  price?: number;
  stock?: number;
}

export interface SeededProduct {
  id: number;
  name: string;
  price: string; // NUMERIC wraca z pg jako string
  stock: number;
}

export async function seedProduct(
  pool: Pool,
  options: SeedProductOptions = {},
): Promise<SeededProduct> {
  const opts = {
    name: options.name ?? "Test Product",
    price: options.price ?? 29.99,
    stock: options.stock ?? 100,
  };

  const result = await pool.query(
    `INSERT INTO products (name, price, stock)
     VALUES ($1, $2, $3)
     RETURNING id, name, price, stock`,
    [opts.name, opts.price, opts.stock],
  );

  return result.rows[0];
}
