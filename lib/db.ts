import postgres from "postgres";

declare global {
  // eslint-disable-next-line no-var
  var __companyChatSql: ReturnType<typeof postgres> | undefined;
}

export function getSql() {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  if (!globalThis.__companyChatSql) {
    globalThis.__companyChatSql = postgres(url, { max: 5, prepare: false });
  }
  return globalThis.__companyChatSql;
}
