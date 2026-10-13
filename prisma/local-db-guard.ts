/*
 * Destructive tooling (seed, migrate reset) is written for a local
 * development database. `.env` may well point at the hosted one, so
 * these scripts refuse to run against anything that isn't local unless
 * SEED_ALLOW_REMOTE=1 is set for that one command.
 */

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]", "host.docker.internal"]);

export function databaseHost(connectionString: string): string {
  try {
    return new URL(connectionString).hostname.toLowerCase();
  } catch {
    return "";
  }
}

/** Local machine, or a docker-compose service name such as "db" (no dots). */
export function isLocalHost(host: string): boolean {
  return LOCAL_HOSTS.has(host) || (host !== "" && !host.includes(".") && !host.includes(":"));
}

export function assertLocalDatabase(connectionString: string | undefined, purpose: string): void {
  if (!connectionString) throw new Error("DATABASE_URL is not set");
  const host = databaseHost(connectionString);
  if (isLocalHost(host) || process.env.SEED_ALLOW_REMOTE === "1") return;
  console.error(
    [
      `✗ Refusing to ${purpose}: DATABASE_URL points at "${host || "an unparseable host"}", not a local database.`,
      "  Point DATABASE_URL at a local/dev database, or — only if you are sure —",
      "  re-run with SEED_ALLOW_REMOTE=1 for this one command.",
    ].join("\n"),
  );
  process.exit(1);
}
