import { type Database, bidSsfReplay, bidUserProfile } from "@auction/db";
import {
  type NormalizedSsfSignal,
  SSF_EVENT_TYPES,
  SSF_VERIFICATION_EVENT,
  type SsfReplayStore,
} from "@auction/identity-contracts";
import { and, eq, isNull, sql } from "drizzle-orm";

/** Atomically reserves a SET JTI and applies convergent Bid-local state. */
export function createBidSsfReplayStore(db: Database): SsfReplayStore {
  return {
    consume: (signal, expiresAt) =>
      db.transaction(async (tx) => {
        const inserted = await tx
          .insert(bidSsfReplay)
          .values({ jti: signal.jti, expiresAt })
          .onConflictDoNothing()
          .returning({ jti: bidSsfReplay.jti });
        if (inserted.length === 0) return false;
        await applyBidSignal(tx as Database, signal);
        return true;
      }),
  };
}

async function applyBidSignal(db: Database, signal: NormalizedSsfSignal): Promise<void> {
  const observedAt = new Date(signal.issuedAt * 1000);
  switch (signal.eventType) {
    case SSF_EVENT_TYPES.ACCOUNT_DISABLED:
    case SSF_EVENT_TYPES.ACCOUNT_PURGED:
      await db
        .update(bidUserProfile)
        .set({
          identityDisabledAt: sql`coalesce(${bidUserProfile.identityDisabledAt}, ${observedAt})`,
          updatedAt: observedAt,
        })
        .where(eq(bidUserProfile.userId, signal.subjectId));
      break;
    case SSF_EVENT_TYPES.ACCOUNT_ENABLED:
      await db
        .update(bidUserProfile)
        .set({ identityDisabledAt: null, updatedAt: observedAt })
        .where(
          and(
            eq(bidUserProfile.userId, signal.subjectId),
            isNull(bidUserProfile.mergedIntoSubjectId),
          ),
        );
      break;
    case SSF_EVENT_TYPES.LAX_IDENTITY_MERGED: {
      const canonicalSubjectId = signal.event.canonical_subject_id;
      if (typeof canonicalSubjectId !== "string") throw new Error("invalid_merge_signal");
      await db
        .update(bidUserProfile)
        .set({
          identityDisabledAt: sql`coalesce(${bidUserProfile.identityDisabledAt}, ${observedAt})`,
          mergedIntoSubjectId: canonicalSubjectId,
          updatedAt: observedAt,
        })
        .where(eq(bidUserProfile.userId, signal.subjectId));
      break;
    }
    // Bid API does not own browser/issuer sessions or credentials. Back-channel
    // logout remains the RP session mechanism.
    case SSF_EVENT_TYPES.SESSION_REVOKED:
    case SSF_EVENT_TYPES.CREDENTIAL_CHANGE:
    case SSF_EVENT_TYPES.IDENTIFIER_RECYCLED:
    case SSF_VERIFICATION_EVENT:
      break;
  }
}
