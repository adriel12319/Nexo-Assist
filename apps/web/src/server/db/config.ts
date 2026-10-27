// Na Vercel, a integração do Turso injeta TURSO_DATABASE_URL e TURSO_AUTH_TOKEN.
export function databaseConfig() {
  const url = process.env.APP_DATABASE_URL ?? process.env.TURSO_DATABASE_URL ?? "file:../../data/app.db";
  const authToken = url.startsWith("file:") ? undefined : (process.env.APP_DATABASE_TOKEN ?? process.env.TURSO_AUTH_TOKEN);
  return { url, authToken };
}
