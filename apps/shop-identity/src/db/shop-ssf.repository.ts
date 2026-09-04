import {
  type NormalizedSsfSignal,
  SSF_EVENT_TYPES,
  SSF_VERIFICATION_EVENT,
  type SsfReplayStore,
} from "@auction/identity-contracts";
import type { Pool, PoolClient } from "pg";

export function createPgShopSsfRepository(pool: Pool): SsfReplayStore {
  return {
    async consume(signal, expiresAt) {
      const client = await pool.connect();
      try {
        await client.query("begin");
        const inserted = await client.query(
          `insert into shop_ssf_replay (jti, expires_at, created_at)
           values ($1, $2, now()) on conflict do nothing returning jti`,
          [signal.jti, expiresAt],
        );
        if (inserted.rowCount === 0) {
          await client.query("rollback");
          return false;
        }
        await applyShopSignal(client, signal);
        await client.query("commit");
        return true;
      } catch (error) {
        await client.query("rollback");
        throw error;
      } finally {
        client.release();
      }
    },
  };
}

async function applyShopSignal(client: PoolClient, signal: NormalizedSsfSignal): Promise<void> {
  const observedAt = new Date(signal.issuedAt * 1000);
  switch (signal.eventType) {
    case SSF_EVENT_TYPES.ACCOUNT_DISABLED:
    case SSF_EVENT_TYPES.ACCOUNT_PURGED:
      await client.query(
        `update shop_user_profile
            set disabled_at = coalesce(disabled_at, $2), updated_at = $2
          where identity_subject_id = $1`,
        [signal.subjectId, observedAt],
      );
      await invalidateShopSessions(client, signal.subjectId);
      break;
    case SSF_EVENT_TYPES.ACCOUNT_ENABLED:
      await client.query(
        `update shop_user_profile
            set disabled_at = null, updated_at = $2
          where identity_subject_id = $1 and merged_into_subject_id is null`,
        [signal.subjectId, observedAt],
      );
      break;
    case SSF_EVENT_TYPES.LAX_IDENTITY_MERGED: {
      const canonicalSubjectId = signal.event.canonical_subject_id;
      if (typeof canonicalSubjectId !== "string") throw new Error("invalid_merge_signal");
      await client.query(
        `update shop_user_profile
            set disabled_at = coalesce(disabled_at, $3),
                merged_into_subject_id = $2,
                updated_at = $3
          where identity_subject_id = $1`,
        [signal.subjectId, canonicalSubjectId, observedAt],
      );
      await invalidateShopSessions(client, signal.subjectId);
      break;
    }
    case SSF_EVENT_TYPES.SESSION_REVOKED:
      await invalidateShopSessions(client, signal.subjectId);
      break;
    case SSF_EVENT_TYPES.CREDENTIAL_CHANGE:
      await client.query(
        `update shop_identity_session
            set invalidated_at = coalesce(invalidated_at, now()), updated_at = now()
          where subject_id = $1`,
        [signal.subjectId],
      );
      break;
    case SSF_VERIFICATION_EVENT:
      break;
  }
}

async function invalidateShopSessions(client: PoolClient, identifier: string): Promise<void> {
  await client.query(
    `update shop_identity_session
        set invalidated_at = coalesce(invalidated_at, now()), updated_at = now()
      where subject_id = $1 or sid = $1`,
    [identifier],
  );
}
