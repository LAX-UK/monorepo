import type { PoolConfig } from "pg";

/**
 * Build the `pg` SSL config for managed Postgres (DigitalOcean, RDS, etc.).
 *
 * Newer pg-connection-string treats `sslmode=require` as `verify-full`, so a
 * connection to a cluster fronted by a private CA fails with
 * `SELF_SIGNED_CERT_IN_CHAIN` unless we supply the CA explicitly.
 *
 * - `DATABASE_CA_CERT`: PEM-encoded CA certificate. Preferred path.
 * - `DATABASE_SSL_REJECT_UNAUTHORIZED=false`: opt-out escape hatch for local
 *   debugging only. Never set in production.
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
