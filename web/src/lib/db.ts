import postgres from "postgres";

let _sql: ReturnType<typeof postgres> | null = null;

export function getSql() {
  if (_sql) return _sql;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }
  _sql = postgres(url, {
    ssl: "require",
    max: 5,
    idle_timeout: 20,
    connect_timeout: 10,
  });
  return _sql;
}
