import {
  AUTH_AT_REST_ENVELOPE_PREFIX,
  AUTH_AT_REST_TOKEN_HASH_PREFIX,
  type EnvelopeCrypto,
  accountTokensNeedUpdate,
  oauthAccessTokenNeedsUpdate,
  transformAccountTokens,
  transformJwksPrivateJwk,
  transformOauthAccessToken,
  transformTwoFactor,
  twoFactorNeedsUpdate,
} from "@auction/identity-contracts";
import {
  type AuthAtRestPendingCounts,
  type AuthAtRestQueryable,
  countAuthAtRestPending,
  totalAuthAtRestPending,
  verifyAuthAtRestStorage,
} from "@auction/identity-db";
import type pg from "pg";

export type { AuthAtRestPendingCounts };

export async function inventoryAuthAtRest(
  db: AuthAtRestQueryable,
): Promise<AuthAtRestPendingCounts> {
  return countAuthAtRestPending(db);
}

export async function verifyAuthAtRestComplete(
  db: AuthAtRestQueryable,
  crypto: EnvelopeCrypto,
  batchSize = 100,
): Promise<void> {
  await verifyAuthAtRestStorage(db, crypto, batchSize);
}

export function formatAuthAtRestInventory(counts: AuthAtRestPendingCounts): string {
  return JSON.stringify({
    account: counts.account,
    oauthAccessToken: counts.oauthAccessToken,
    twoFactor: counts.twoFactor,
    jwksKey: counts.jwksKey,
    total: totalAuthAtRestPending(counts),
  });
}

export type AuthAtRestApplyStats = AuthAtRestPendingCounts;

export type AuthAtRestBatchProgress = {
  category: keyof AuthAtRestApplyStats;
  scanned: number;
  updated: number;
  cursor: string;
};

type AuthAtRestApplyInput = {
  crypto: EnvelopeCrypto;
  batchSize: number;
  lockTimeoutMs?: number;
  statementTimeoutMs?: number;
  onBatch?: (progress: AuthAtRestBatchProgress) => void;
};

async function withBatchTransaction<T>(
  pool: pg.Pool,
  input: AuthAtRestApplyInput,
  run: (client: pg.PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query("select set_config('lock_timeout', $1, true)", [
      `${input.lockTimeoutMs ?? 5_000}ms`,
    ]);
    await client.query("select set_config('statement_timeout', $1, true)", [
      `${input.statementTimeoutMs ?? 30_000}ms`,
    ]);
    const result = await run(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function applyAuthAtRestBackfill(
  pool: pg.Pool,
  input: AuthAtRestApplyInput,
): Promise<AuthAtRestApplyStats> {
  const stats: AuthAtRestApplyStats = {
    account: 0,
    oauthAccessToken: 0,
    twoFactor: 0,
    jwksKey: 0,
  };

  stats.account += await applyAccountBatches(pool, input);
  stats.oauthAccessToken += await applyOauthAccessTokenBatches(pool, input);
  stats.twoFactor += await applyTwoFactorBatches(pool, input);
  stats.jwksKey += await applyJwksKeyBatches(pool, input);

  return stats;
}

async function applyAccountBatches(pool: pg.Pool, input: AuthAtRestApplyInput): Promise<number> {
  let updated = 0;
  let cursor = "";
  const envelopePrefix = `${AUTH_AT_REST_ENVELOPE_PREFIX}%`;

  for (;;) {
    const batch = await withBatchTransaction(pool, input, async (client) => {
      const { rows } = await client.query<{
        id: string;
        access_token: string | null;
        refresh_token: string | null;
        id_token: string | null;
      }>(
        `select id, access_token, refresh_token, id_token
         from "account"
         where id > $1
           and (
             ("access_token" is not null and "access_token" not like $2)
             or ("refresh_token" is not null and "refresh_token" not like $2)
             or ("id_token" is not null and "id_token" not like $2)
           )
         order by id
         limit $3
         for update skip locked`,
        [cursor, envelopePrefix, input.batchSize],
      );
      let batchUpdated = 0;

      for (const row of rows) {
        const before = {
          accessToken: row.access_token,
          refreshToken: row.refresh_token,
          idToken: row.id_token,
        };
        const after = transformAccountTokens(before, input.crypto);
        if (!accountTokensNeedUpdate(before, after)) continue;

        const result = await client.query(
          `update "account"
           set access_token = $2,
               refresh_token = $3,
               id_token = $4,
               updated_at = now()
           where id = $1
             and access_token is not distinct from $5
             and refresh_token is not distinct from $6
             and id_token is not distinct from $7`,
          [
            row.id,
            after.accessToken,
            after.refreshToken,
            after.idToken,
            row.access_token,
            row.refresh_token,
            row.id_token,
          ],
        );
        batchUpdated += result.rowCount ?? 0;
      }
      return { rows, updated: batchUpdated };
    });
    const { rows } = batch;
    if (rows.length === 0) break;
    updated += batch.updated;
    cursor = rows.at(-1)?.id ?? cursor;
    input.onBatch?.({
      category: "account",
      scanned: rows.length,
      updated: batch.updated,
      cursor,
    });
    if (rows.length < input.batchSize) break;
  }

  return updated;
}

async function applyOauthAccessTokenBatches(
  pool: pg.Pool,
  input: AuthAtRestApplyInput,
): Promise<number> {
  let updated = 0;
  let cursor = "";
  const tokenPrefix = `${AUTH_AT_REST_TOKEN_HASH_PREFIX}%`;

  for (;;) {
    const batch = await withBatchTransaction(pool, input, async (client) => {
      const { rows } = await client.query<{
        id: string;
        access_token: string;
        refresh_token: string;
        refresh_token_hash: string | null;
      }>(
        `select id, access_token, refresh_token, refresh_token_hash
         from "oauth_access_token"
         where id > $1
           and ("access_token" not like $2 or "refresh_token" not like $2)
         order by id
         limit $3
         for update skip locked`,
        [cursor, tokenPrefix, input.batchSize],
      );
      let batchUpdated = 0;

      for (const row of rows) {
        const before = {
          accessToken: row.access_token,
          refreshToken: row.refresh_token,
          refreshTokenHash: row.refresh_token_hash,
        };
        const after = transformOauthAccessToken(before);
        if (!oauthAccessTokenNeedsUpdate(before, after)) continue;

        const result = await client.query(
          `update "oauth_access_token"
           set access_token = $2,
               refresh_token = $3,
               refresh_token_hash = $4,
               updated_at = now()
           where id = $1
             and access_token = $5
             and refresh_token = $6
             and refresh_token_hash is not distinct from $7`,
          [
            row.id,
            after.accessToken,
            after.refreshToken,
            after.refreshTokenHash,
            row.access_token,
            row.refresh_token,
            row.refresh_token_hash,
          ],
        );
        batchUpdated += result.rowCount ?? 0;
      }
      return { rows, updated: batchUpdated };
    });
    const { rows } = batch;
    if (rows.length === 0) break;
    updated += batch.updated;
    cursor = rows.at(-1)?.id ?? cursor;
    input.onBatch?.({
      category: "oauthAccessToken",
      scanned: rows.length,
      updated: batch.updated,
      cursor,
    });
    if (rows.length < input.batchSize) break;
  }

  return updated;
}

async function applyTwoFactorBatches(pool: pg.Pool, input: AuthAtRestApplyInput): Promise<number> {
  let updated = 0;
  let cursor = "";
  const envelopePrefix = `${AUTH_AT_REST_ENVELOPE_PREFIX}%`;

  for (;;) {
    const batch = await withBatchTransaction(pool, input, async (client) => {
      const { rows } = await client.query<{
        id: string;
        secret: string;
        backup_codes: string;
      }>(
        `select id, secret, backup_codes
         from "two_factor"
         where id > $1
           and ("secret" not like $2 or "backup_codes" not like $2)
         order by id
         limit $3
         for update skip locked`,
        [cursor, envelopePrefix, input.batchSize],
      );
      let batchUpdated = 0;

      for (const row of rows) {
        const before = { secret: row.secret, backupCodes: row.backup_codes };
        const after = transformTwoFactor(before, input.crypto);
        if (!twoFactorNeedsUpdate(before, after)) continue;

        const result = await client.query(
          `update "two_factor"
           set secret = $2, backup_codes = $3
           where id = $1
             and secret = $4
             and backup_codes = $5`,
          [row.id, after.secret, after.backupCodes, row.secret, row.backup_codes],
        );
        batchUpdated += result.rowCount ?? 0;
      }
      return { rows, updated: batchUpdated };
    });
    const { rows } = batch;
    if (rows.length === 0) break;
    updated += batch.updated;
    cursor = rows.at(-1)?.id ?? cursor;
    input.onBatch?.({
      category: "twoFactor",
      scanned: rows.length,
      updated: batch.updated,
      cursor,
    });
    if (rows.length < input.batchSize) break;
  }

  return updated;
}

async function applyJwksKeyBatches(pool: pg.Pool, input: AuthAtRestApplyInput): Promise<number> {
  let updated = 0;
  let cursor = "";
  const envelopePrefix = `${AUTH_AT_REST_ENVELOPE_PREFIX}%`;

  for (;;) {
    const batch = await withBatchTransaction(pool, input, async (client) => {
      const { rows } = await client.query<{ kid: string; private_jwk: unknown }>(
        `select kid, private_jwk
         from "jwks_key"
         where kid > $1
           and "private_jwk" #>> '{}' not like $2
         order by kid
         limit $3
         for update skip locked`,
        [cursor, envelopePrefix, input.batchSize],
      );
      let batchUpdated = 0;

      for (const row of rows) {
        const raw =
          typeof row.private_jwk === "string"
            ? row.private_jwk
            : JSON.stringify(row.private_jwk as object);
        const sealed = transformJwksPrivateJwk(raw, input.crypto);
        if (sealed == null) continue;

        const result = await client.query(
          `update "jwks_key"
           set private_jwk = to_jsonb($2::text)
           where kid = $1
             and "private_jwk" #>> '{}' = $3`,
          [row.kid, sealed, raw],
        );
        batchUpdated += result.rowCount ?? 0;
      }
      return { rows, updated: batchUpdated };
    });
    const { rows } = batch;
    if (rows.length === 0) break;
    updated += batch.updated;
    cursor = rows.at(-1)?.kid ?? cursor;
    input.onBatch?.({
      category: "jwksKey",
      scanned: rows.length,
      updated: batch.updated,
      cursor,
    });
    if (rows.length < input.batchSize) break;
  }

  return updated;
}
