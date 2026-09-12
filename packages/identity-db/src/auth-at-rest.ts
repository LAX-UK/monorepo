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

export type AuthAtRestPendingCounts = {
  account: number;
  oauthAccessToken: number;
  twoFactor: number;
  jwksKey: number;
};

export type AuthAtRestQueryable = {
  query: <T = unknown>(sql: string, params?: unknown[]) => Promise<{ rows: T[] }>;
};

export async function countAuthAtRestPending(
  db: AuthAtRestQueryable,
): Promise<AuthAtRestPendingCounts> {
  const envelopePrefix = `${AUTH_AT_REST_ENVELOPE_PREFIX}%`;
  const tokenPrefix = `${AUTH_AT_REST_TOKEN_HASH_PREFIX}%`;
  const [account, oauthAccessToken, twoFactor, jwksKey] = await Promise.all([
    db.query<{ count: number }>(
      `select count(*)::int as count from "account"
       where ("access_token" is not null and "access_token" not like $1)
          or ("refresh_token" is not null and "refresh_token" not like $1)
          or ("id_token" is not null and "id_token" not like $1)`,
      [envelopePrefix],
    ),
    db.query<{ count: number }>(
      `select count(*)::int as count from "oauth_access_token"
       where "access_token" not like $1 or "refresh_token" not like $1`,
      [tokenPrefix],
    ),
    db.query<{ count: number }>(
      `select count(*)::int as count from "two_factor"
       where "secret" not like $1 or "backup_codes" not like $1`,
      [envelopePrefix],
    ),
    db.query<{ count: number }>(
      `select count(*)::int as count from "jwks_key"
       where "private_jwk" #>> '{}' not like $1`,
      [envelopePrefix],
    ),
  ]);
  return {
    account: account.rows[0]?.count ?? 0,
    oauthAccessToken: oauthAccessToken.rows[0]?.count ?? 0,
    twoFactor: twoFactor.rows[0]?.count ?? 0,
    jwksKey: jwksKey.rows[0]?.count ?? 0,
  };
}

export function totalAuthAtRestPending(counts: AuthAtRestPendingCounts): number {
  return counts.account + counts.oauthAccessToken + counts.twoFactor + counts.jwksKey;
}

export async function hasAuthAtRestPending(db: AuthAtRestQueryable): Promise<boolean> {
  return totalAuthAtRestPending(await countAuthAtRestPending(db)) > 0;
}

async function scanAuthAtRestRows<T>(
  db: AuthAtRestQueryable,
  sql: string,
  batchSize: number,
  cursorOf: (row: T) => string,
  verify: (row: T) => void,
): Promise<void> {
  let cursor = "";
  for (;;) {
    const { rows } = await db.query<T>(sql, [cursor, batchSize]);
    for (const row of rows) verify(row);
    if (rows.length < batchSize) return;
    cursor = cursorOf(rows.at(-1) as T);
  }
}

/** Verify that every protected value is transformed and decryptable by the active key. */
export async function verifyAuthAtRestStorage(
  db: AuthAtRestQueryable,
  crypto: EnvelopeCrypto,
  batchSize = 500,
): Promise<void> {
  const counts = await countAuthAtRestPending(db);
  if (totalAuthAtRestPending(counts) > 0) {
    throw new Error(`auth_at_rest_verify_failed pending=${JSON.stringify(counts)}`);
  }

  await scanAuthAtRestRows<{
    id: string;
    access_token: string | null;
    refresh_token: string | null;
    id_token: string | null;
  }>(
    db,
    `select id, access_token, refresh_token, id_token
     from "account" where id > $1 order by id limit $2`,
    batchSize,
    (row) => row.id,
    (row) => {
      const before = {
        accessToken: row.access_token,
        refreshToken: row.refresh_token,
        idToken: row.id_token,
      };
      if (accountTokensNeedUpdate(before, transformAccountTokens(before, crypto))) {
        throw new Error("auth_at_rest_verify_found_plaintext_account");
      }
    },
  );

  await scanAuthAtRestRows<{
    id: string;
    access_token: string;
    refresh_token: string;
    refresh_token_hash: string | null;
  }>(
    db,
    `select id, access_token, refresh_token, refresh_token_hash
     from "oauth_access_token" where id > $1 order by id limit $2`,
    batchSize,
    (row) => row.id,
    (row) => {
      const before = {
        accessToken: row.access_token,
        refreshToken: row.refresh_token,
        refreshTokenHash: row.refresh_token_hash,
      };
      if (oauthAccessTokenNeedsUpdate(before, transformOauthAccessToken(before))) {
        throw new Error("auth_at_rest_verify_found_plaintext_oauth_token");
      }
    },
  );

  await scanAuthAtRestRows<{
    id: string;
    secret: string;
    backup_codes: string;
  }>(
    db,
    `select id, secret, backup_codes
     from "two_factor" where id > $1 order by id limit $2`,
    batchSize,
    (row) => row.id,
    (row) => {
      const before = { secret: row.secret, backupCodes: row.backup_codes };
      if (twoFactorNeedsUpdate(before, transformTwoFactor(before, crypto))) {
        throw new Error("auth_at_rest_verify_found_plaintext_two_factor");
      }
    },
  );

  await scanAuthAtRestRows<{ kid: string; private_jwk: unknown }>(
    db,
    `select kid, private_jwk
     from "jwks_key" where kid > $1 order by kid limit $2`,
    batchSize,
    (row) => row.kid,
    (row) => {
      const raw =
        typeof row.private_jwk === "string"
          ? row.private_jwk
          : JSON.stringify(row.private_jwk as object);
      if (transformJwksPrivateJwk(raw, crypto) !== null) {
        throw new Error("auth_at_rest_verify_found_plaintext_jwks_key");
      }
    },
  );
}
