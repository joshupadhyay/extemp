import { Pool } from "pg";

// Strip sslmode from connection string — pg treats "require" as "verify-full"
// which rejects Supabase's self-signed cert. We handle SSL via the Pool config.
const raw = process.env.DATABASE_URL || process.env.POSTGRES_URL || "";
let connectionString = raw;
if (raw) {
  const url = new URL(raw);
  url.searchParams.delete("sslmode");
  connectionString = url.toString();
}

export const pool = new Pool({
  connectionString,
  ssl: raw ? { rejectUnauthorized: false } : undefined,
});
