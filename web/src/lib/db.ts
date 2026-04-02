import postgres from "postgres";

/** Embedded for class deployment; env DATABASE_URL overrides when set. */
const DEFAULT_DATABASE_URL =
  "postgresql://postgres.sbltgtzecialnwsdvxfa:parkerracheljoshuawilliam@aws-1-us-east-2.pooler.supabase.com:6543/postgres";

let _sql: ReturnType<typeof postgres> | null = null;

export function getSql() {
  if (_sql) return _sql;
  const url = process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL;
  // Transaction pooler (port 6543) uses PgBouncer — disable prepared statements.
  // Direct db.*.supabase.co:5432 is often IPv6-only; Vercel serverless may fail — use pooler URI from Supabase.
  _sql = postgres(url, {
    ssl: "require",
    prepare: false,
    max: 1,
    idle_timeout: 20,
    connect_timeout: 15,
  });
  return _sql;
}
