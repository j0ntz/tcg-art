import { defineConfig } from "drizzle-kit";

// Migrations are generated from lib/db/schema.ts into drizzle/ (committed).
// `npx drizzle-kit generate` needs no database; `npx drizzle-kit migrate`
// applies them to DATABASE_URL (the dev PGlite fallback self-migrates on boot).
export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://localhost:5432/tcg-art",
  },
});
