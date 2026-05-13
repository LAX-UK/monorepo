import type { PoolConfig } from "pg";

/** Build the `pg` SSL config for managed Postgres (DigitalOcean, RDS, etc.).
 * * Newer pg-connection-string treats `sslmode=require` as `verify-full`, so a
 * connection to a cluster fronted by a private CA fails with
 * `SELF_SIGNED_CERT_IN_CHAIN` unless we supply the CA explicitly.
 * * - `DATABASE_CA_CERT`: PEM-encoded CA certificate. Preferred path.
 * - `DATABASE_SSL_REJECT_UNAUTHORIZED=false`: opt-out escape hatch for local
 * debugging only. Never set in production.
 */
export function buildPgSslConfig(): PoolConfig["ssl"] {
  const ca = process.env.DATABASE_CA_CERT;
  if (ca && ca.trim().length > 0) {
    return { ca };
  }
  if (process.env.DATABASE_SSL_REJECT_UNAUTHORIZED === "false") {
    return { rejectUnauthorized: false };
  }
  return undefined;
}

/** Build a `pg.Pool` / `pg.Client` config from a connection string while ensuring
 * our explicit `ssl` always wins over any sslmode embedded in the URL.
 * * `pg.ConnectionParameters` does `Object.assign({}, config, parse(connectionString))`,
 * so any `ssl` we pass alongside `connectionString` is silently overwritten by
 * the URL parse result (e.g. `sslmode=require` → `{ rejectUnauthorized: true }`),
 * which drops our `ca` and reproduces SELF_SIGNED_CERT_IN_CHAIN against private
 * CAs like DigitalOcean Managed Postgres. Stripping `sslmode` (and friends) from
 * the URL leaves our `ssl` option as the sole source of truth, and also silences
 * the upcoming pg-connection-string v3 deprecation warning.
 */
export function buildPgConnectionConfig(connectionString: string): {
  connectionString: string;
  ssl: PoolConfig["ssl"];
} {
  const ssl = buildPgSslConfig();
  if (!ssl) {
    return { connectionString, ssl: undefined };
  }
  let cleaned = connectionString;
  try {
    const url = new URL(connectionString);
    for (const key of ["sslmode", "ssl", "sslrootcert", "sslcert", "sslkey", "uselibpqcompat"]) {
      url.searchParams.delete(key);
    }
    cleaned = url.toString();
  } catch {
    // Not a parseable URL (e.g. socket DSN); fall through with the original.
  }
  return { connectionString: cleaned, ssl };
}
