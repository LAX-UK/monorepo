import { randomBytes } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import type {
  LogoutToken,
  PendingOAuthSession,
  ShopIdentitySession,
  ShopSessionRepository,
} from "../session.js";

export function createPgShopSessionRepository(pool: Pool): ShopSessionRepository {
  return {
    async findActive(id): Promise<ShopIdentitySession | null> {
      const result = await pool.query<{
        id: string;
        subject_id: string | null;
        sid: string | null;
        oauth_state: string | null;
        oauth_nonce: string | null;
        oauth_code_verifier: string | null;
      }>(
        `select id, subject_id, sid, oauth_state, oauth_nonce, oauth_code_verifier
           from shop_identity_session
          where id = $1 and invalidated_at is null and expires_at > now()
          limit 1`,
        [id],
      );
      const row = result.rows[0];
      if (!row) return null;
      return {
        id: row.id,
        subject: row.subject_id,
        sid: row.sid,
        oauth:
          row.oauth_state && row.oauth_nonce && row.oauth_code_verifier
            ? {
                state: row.oauth_state,
                nonce: row.oauth_nonce,
                codeVerifier: row.oauth_code_verifier,
              }
            : null,
      };
    },

    async createPendingOAuth(oauth: PendingOAuthSession): Promise<string> {
      const id = randomBytes(32).toString("base64url");
      await pool.query(
        `insert into shop_identity_session
          (id, oauth_state, oauth_nonce, oauth_code_verifier, expires_at, created_at, updated_at)
         values ($1, $2, $3, $4, now() + interval '10 minutes', now(), now())`,
        [id, oauth.state, oauth.nonce, oauth.codeVerifier],
      );
      return id;
    },

    async attachPendingOAuthToAuthenticatedSession(
      sessionId: string,
      oauth: PendingOAuthSession,
    ): Promise<boolean> {
      const result = await pool.query(
        `update shop_identity_session
            set oauth_state = $2,
                oauth_nonce = $3,
                oauth_code_verifier = $4,
                updated_at = now()
          where id = $1
            and subject_id is not null
            and invalidated_at is null
            and expires_at > now()`,
        [sessionId, oauth.state, oauth.nonce, oauth.codeVerifier],
      );
      return (result.rowCount ?? 0) > 0;
    },

    async createGuestSession(): Promise<string> {
      const id = randomBytes(32).toString("base64url");
      await pool.query(
        `insert into shop_identity_session
          (id, expires_at, created_at, updated_at)
         values ($1, now() + interval '14 days', now(), now())`,
        [id],
      );
      return id;
    },

    async authenticate(input): Promise<string> {
      const newId = randomBytes(32).toString("base64url");
      const client = await pool.connect();
      try {
        await client.query("begin");
        await client.query(
          `insert into shop_identity_session
            (id, subject_id, sid, expires_at, created_at, updated_at)
           values ($1, $2, $3, now() + interval '7 days', now(), now())`,
          [newId, input.subject, input.sid],
        );
        await client.query(
          `update shop_identity_session
              set invalidated_at = now(), updated_at = now()
            where id = $1`,
          [input.id],
        );
        await client.query("commit");
        return newId;
      } catch (error) {
        await client.query("rollback");
        throw error;
      } finally {
        client.release();
      }
    },

    async invalidate(id): Promise<void> {
      if (!id) return;
      await pool.query(
        "update shop_identity_session set invalidated_at = now(), updated_at = now() where id = $1",
        [id],
      );
    },

    async consumeLogoutToken(input): Promise<"consumed" | "replay"> {
      return consumeLogoutToken(pool, input);
    },
  };
}

async function consumeLogoutToken(pool: Pool, input: LogoutToken): Promise<"consumed" | "replay"> {
  const client = await pool.connect();
  try {
    await client.query("begin");
    const inserted = await client.query(
      `insert into shop_logout_token_replay (jti, expires_at, created_at)
       values ($1, $2, now()) on conflict do nothing returning jti`,
      [input.jti, input.expiresAt],
    );
    if (inserted.rowCount === 0) {
      await client.query("rollback");
      return "replay";
    }
    await invalidateTarget(client, input);
    await client.query("commit");
    return "consumed";
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

async function invalidateTarget(
  client: PoolClient,
  input: Pick<LogoutToken, "sid" | "sub">,
): Promise<void> {
  if (input.sid) {
    await client.query(
      `update shop_identity_session
          set invalidated_at = coalesce(invalidated_at, now()), updated_at = now()
        where sid = $1`,
      [input.sid],
    );
  } else if (input.sub) {
    await client.query(
      `update shop_identity_session
          set invalidated_at = coalesce(invalidated_at, now()), updated_at = now()
        where subject_id = $1`,
      [input.sub],
    );
  }
}
