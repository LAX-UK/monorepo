/**
 * One-shot: envelope-seal plaintext OAuth tokens + 2FA columns + JWKS private keys.
 * Requires AUTH_DEK_KEY (same as auth issuer). Run against auth database.
 *
 * Usage from packages/db:
 *   AUTH_DEK_KEY=... DATABASE_URL=... pnpm exec tsx scripts/backfill-auth-at-rest.ts
 */
import { Buffer } from "node:buffer";
import { createCipheriv, randomBytes } from "node:crypto";
import pg from "pg";
import { buildPgConnectionConfig } from "../src/ssl.js";

const { Pool } = pg;

const PREFIX = "v1:";

function parseDek(raw: string): Buffer {
  const trimmed = raw.trim();
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) return Buffer.from(trimmed, "hex");
  const b64 = trimmed.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
  const buf = Buffer.from(b64 + pad, "base64");
  if (buf.length !== 32) throw new Error("AUTH_DEK_KEY must decode to 32 bytes");
  return buf;
}

function seal(plaintext: string, dek: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", dek, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  const packed = Buffer.concat([iv, tag, enc]);
  return `${PREFIX}${packed.toString("base64url")}`;
}

async function main() {
  const url = process.env.DATABASE_URL ?? process.env.DATABASE_URL_AUTH;
  const rawDek = process.env.AUTH_DEK_KEY;
  if (!url || !rawDek) {
    console.error("Set DATABASE_URL (or DATABASE_URL_AUTH) and AUTH_DEK_KEY");
    process.exit(1);
  }
  const dek = parseDek(rawDek);
  const pool = new Pool(buildPgConnectionConfig(url));

  const { rows: accounts } = await pool.query<{
    id: string;
    access_token: string | null;
    refresh_token: string | null;
    id_token: string | null;
  }>("select id, access_token, refresh_token, id_token from account");

  let a = 0;
  for (const row of accounts) {
    const at =
      row.access_token && !row.access_token.startsWith(PREFIX)
        ? seal(row.access_token, dek)
        : row.access_token;
    const rt =
      row.refresh_token && !row.refresh_token.startsWith(PREFIX)
        ? seal(row.refresh_token, dek)
        : row.refresh_token;
    const idt =
      row.id_token && !row.id_token.startsWith(PREFIX) ? seal(row.id_token, dek) : row.id_token;
    if (at !== row.access_token || rt !== row.refresh_token || idt !== row.id_token) {
      await pool.query(
        "update account set access_token = $2, refresh_token = $3, id_token = $4, updated_at = now() where id = $1",
        [row.id, at, rt, idt],
      );
      a += 1;
    }
  }

  const { rows: tf } = await pool.query<{
    id: string;
    secret: string;
    backup_codes: string;
  }>("select id, secret, backup_codes from two_factor");

  let t = 0;
  for (const row of tf) {
    const sec = row.secret.startsWith(PREFIX) ? row.secret : seal(row.secret, dek);
    const bc = row.backup_codes.startsWith(PREFIX) ? row.backup_codes : seal(row.backup_codes, dek);
    if (sec !== row.secret || bc !== row.backup_codes) {
      await pool.query("update two_factor set secret = $2, backup_codes = $3 where id = $1", [
        row.id,
        sec,
        bc,
      ]);
      t += 1;
    }
  }

  const { rows: keys } = await pool.query<{ kid: string; private_jwk: unknown }>(
    "select kid, private_jwk from jwks_key",
  );
  let k = 0;
  for (const row of keys) {
    const raw =
      typeof row.private_jwk === "string"
        ? row.private_jwk
        : JSON.stringify(row.private_jwk as object);
    if (raw.startsWith(PREFIX)) continue;
    const sealed = seal(raw, dek);
    await pool.query("update jwks_key set private_jwk = to_jsonb($2::text) where kid = $1", [
      row.kid,
      sealed,
    ]);
    k += 1;
  }

  console.log(`Updated accounts=${a}, two_factor=${t}, jwks_key=${k}`);
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
