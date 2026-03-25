import { createClient } from '@libsql/client';

let client: ReturnType<typeof createClient> | null = null;

export function getDb() {
  if (!client) {
    const env = process.env;
    client = createClient({
      url: env['TURSO_DATABASE_URL'] || import.meta.env.TURSO_DATABASE_URL,
      authToken: env['TURSO_AUTH_TOKEN'] || import.meta.env.TURSO_AUTH_TOKEN,
    });
  }
  return client;
}
