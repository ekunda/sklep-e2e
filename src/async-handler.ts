import type { Request, Response, NextFunction, RequestHandler } from "express";

/**
 * Owija asynchroniczny handler tak, by odrzucony Promise trafił do `next(err)`,
 * a stamtąd do centralnego middleware błędów.
 *
 * W Express 4 `async` handler, który rzuci wyjątek, NIE jest łapany domyślnie —
 * request zawisłby. Ten wrapper to standardowe rozwiązanie problemu.
 */
export function ah(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
