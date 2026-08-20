import { Pool } from "pg";

/**
 * One pool per warm serverless instance. Cloud SQL sits behind a connection limit that a
 * pool-per-invocation would exhaust in minutes, so the pool is cached on the module and kept
 * deliberately small — a Vercel function handles one request at a time.
 */
let pool: Pool | undefined;

export function getPool(): Pool {
  if (pool) return pool;

  const connectionString = process.env.PARTNER_DATABASE_URL;
  if (!connectionString) {
    throw new Error("PARTNER_DATABASE_URL is not configured");
  }

  pool = new Pool({
    connectionString,
    max: 2,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 5_000,
    // Cloud SQL terminates TLS with its own CA. Local Docker has no TLS at all.
    ssl: /sslmode=disable/.test(connectionString) ? false : { rejectUnauthorized: false },
  });

  return pool;
}

export async function query<T = any>(text: string, params: any[] = []): Promise<T[]> {
  const result = await getPool().query(text, params);
  return result.rows as T[];
}

export async function queryOne<T = any>(text: string, params: any[] = []): Promise<T | undefined> {
  const rows = await query<T>(text, params);
  return rows[0];
}
