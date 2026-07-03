import type { ExtractTablesWithRelations } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

import * as schema from "./schema";

// Common supertype of both drivers we run on (node-postgres in production,
// PGlite in local dev), so callers stay driver-agnostic.
export type Db = PgDatabase<PgQueryResultHKT, typeof schema, ExtractTablesWithRelations<typeof schema>>;

// Reports whether a database is reachable in this environment WITHOUT opening a
// connection: production needs DATABASE_URL; dev always has the embedded
// PGlite fallback. Used to render the auth UI in a disabled state on
// deployments that aren't provisioned yet (see docs/auth-setup.md).
export const isDbConfigured = (): boolean => {
  const url = process.env.DATABASE_URL;
  if (url != null && url !== "") return true;
  return process.env.NODE_ENV !== "production";
};

const initDb = async (): Promise<Db | null> => {
  const url = process.env.DATABASE_URL;
  if (url != null && url !== "") {
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const { Pool } = await import("pg");
    const pool = new Pool({ connectionString: url });
    return drizzle(pool, { schema });
  }
  if (process.env.NODE_ENV === "production") return null;
  // Dockerless dev fallback: PGlite is a real (WASM) Postgres persisted under
  // .pglite/ (gitignored). Migrations auto-apply here; against a real
  // DATABASE_URL they are applied explicitly with `npx drizzle-kit migrate`.
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  const client = new PGlite(".pglite");
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: "drizzle" });
  return db;
};

// Cached on globalThis so dev hot-reload and per-lambda module re-evaluation
// reuse one pool/PGlite instance. Resolves to null when no database is
// available (production without DATABASE_URL); callers must degrade.
const globalCache = globalThis as unknown as { tcgArtDbPromise?: Promise<Db | null> };

export const getDb = (): Promise<Db | null> => {
  globalCache.tcgArtDbPromise ??= initDb();
  return globalCache.tcgArtDbPromise;
};
