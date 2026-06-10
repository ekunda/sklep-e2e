import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";

export interface TokenPayload {
  userId: number;
  role: string;
}

// Rozszerzamy typ Request o pole ustawiane przez authMiddleware.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: TokenPayload;
    }
  }
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export function signToken(payload: TokenPayload, secret: string): string {
  return jwt.sign(payload, secret, { expiresIn: "1h" });
}

export function verifyToken(token: string, secret: string): TokenPayload {
  return jwt.verify(token, secret) as TokenPayload;
}

/**
 * Middleware autoryzacji. Czyta nagłówek `Authorization: Bearer <token>`,
 * weryfikuje JWT i zapisuje payload w `req.auth`. Brak/niepoprawny token => 401.
 */
export function authMiddleware(secret: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
      res.status(401).json({ error: "Brak tokenu autoryzacji" });
      return;
    }
    const token = header.slice("Bearer ".length);
    try {
      req.auth = verifyToken(token, secret);
      next();
    } catch {
      res.status(401).json({ error: "Nieprawidłowy token" });
    }
  };
}
