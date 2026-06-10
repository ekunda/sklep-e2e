import { createClient, type RedisClientType } from "redis";

/**
 * Tworzy i łączy klienta Redis.
 *
 * Redis służy tu jako cache listy produktów — dzięki temu w testach
 * integracyjnych widać, że aplikacja realnie gada z dwoma usługami
 * (Postgres + Redis), a nie tylko z bazą.
 */
export async function createRedis(url: string): Promise<RedisClientType> {
  const client: RedisClientType = createClient({ url });
  client.on("error", (err) => console.error("[redis] error:", err));
  await client.connect();
  return client;
}

export type { RedisClientType } from "redis";
