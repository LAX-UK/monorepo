import type { Pool, PoolClient } from "pg";
import type {
  SessionTokenReadOptions,
  SessionTokenStore,
  SessionTokens,
} from "../application/ports/session-token.ports.js";
import type { TokenCipher } from "../infrastructure/token-crypto.js";

type TokenRow = {
  id_token_encrypted: string | null;
  refresh_token_encrypted: string | null;
  refresh_expires_at: Date | null;
};

function rowToTokens(row: TokenRow, cipher: TokenCipher): SessionTokens | null {
  if (!row.id_token_encrypted) return null;
  const idToken = cipher.open(row.id_token_encrypted);
  if (!idToken) return null;
  const refreshToken = row.refresh_token_encrypted
    ? cipher.open(row.refresh_token_encrypted)
    : null;
  return {
    idToken,
    refreshToken,
    refreshExpiresAt: row.refresh_expires_at,
  };
}

async function readTokenRow(
  client: Pick<PoolClient, "query">,
  sessionId: string,
): Promise<TokenRow | null> {
  const result = await client.query<TokenRow>(
    `select id_token_encrypted, refresh_token_encrypted, refresh_expires_at
       from shop_identity_session
      where id = $1
        and invalidated_at is null
        and expires_at > now()
      limit 1`,
    [sessionId],
  );
  return result.rows[0] ?? null;
}

export function createPgSessionTokenStore(pool: Pool, cipher: TokenCipher): SessionTokenStore {
  return {
    async read(sessionId, options?: SessionTokenReadOptions): Promise<SessionTokens | null> {
      const row = await readTokenRow(pool, sessionId);
      if (row) {
        const tokens = rowToTokens(row, cipher);
        if (tokens) return tokens;
      }
      const legacy = options?.legacyIdToken?.trim();
      if (legacy) {
        return { idToken: legacy, refreshToken: null, refreshExpiresAt: null };
      }
      return null;
    },

    async save(sessionId, tokens): Promise<void> {
      await pool.query(
        `update shop_identity_session
            set id_token_encrypted = $2,
                refresh_token_encrypted = $3,
                refresh_expires_at = $4,
                updated_at = now()
          where id = $1`,
        [
          sessionId,
          cipher.seal(tokens.idToken),
          tokens.refreshToken ? cipher.seal(tokens.refreshToken) : null,
          tokens.refreshExpiresAt,
        ],
      );
    },

    async clear(sessionId): Promise<void> {
      await pool.query(
        `update shop_identity_session
            set id_token_encrypted = null,
                refresh_token_encrypted = null,
                refresh_expires_at = null,
                updated_at = now()
          where id = $1`,
        [sessionId],
      );
    },

    async hasStoredRefreshToken(sessionId): Promise<boolean> {
      const result = await pool.query<{ has_refresh: boolean }>(
        `select (refresh_token_encrypted is not null) as has_refresh
           from shop_identity_session
          where id = $1
            and invalidated_at is null
            and expires_at > now()
          limit 1`,
        [sessionId],
      );
      return result.rows[0]?.has_refresh === true;
    },

    async withLock<T>(
      sessionId: string,
      run: (ctx: {
        current: SessionTokens | null;
        save: (next: SessionTokens) => Promise<void>;
      }) => Promise<T>,
    ): Promise<T> {
      const client = await pool.connect();
      try {
        await client.query("begin");
        await client.query("set local lock_timeout = '10s'");
        await client.query("select pg_advisory_xact_lock(hashtextextended($1, 0))", [sessionId]);
        const row = await readTokenRow(client, sessionId);
        const current = row ? rowToTokens(row, cipher) : null;
        const save = async (next: SessionTokens): Promise<void> => {
          await client.query(
            `update shop_identity_session
                set id_token_encrypted = $2,
                    refresh_token_encrypted = $3,
                    refresh_expires_at = $4,
                    updated_at = now()
              where id = $1`,
            [
              sessionId,
              cipher.seal(next.idToken),
              next.refreshToken ? cipher.seal(next.refreshToken) : null,
              next.refreshExpiresAt,
            ],
          );
        };
        const result = await run({ current, save });
        await client.query("commit");
        return result;
      } catch (error) {
        await client.query("rollback");
        throw error;
      } finally {
        client.release();
      }
    },
  };
}
