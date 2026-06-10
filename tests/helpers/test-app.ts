import { inject } from "vitest";
import { createApp, type CreatedApp } from "../../src/app.js";

/** Stały sekret JWT dla testów — dzięki temu możemy sami podpisywać tokeny. */
export const TEST_JWT_SECRET = "test-secret";

/**
 * Buduje aplikację wpiętą w kontenery z global-setup (przez inject()).
 * nodeEnv:'test' włącza trasy /api/test/*.
 */
export async function createTestApp(): Promise<CreatedApp> {
  return createApp({
    databaseUrl: inject("databaseUrl"),
    redisUrl: inject("redisUrl"),
    jwtSecret: TEST_JWT_SECRET,
    nodeEnv: "test",
  });
}
