import { createHash } from "node:crypto";
import { type Database, bidSsfReplay, bidUserProfile } from "@auction/db";
import {
  type NormalizedSsfSignal,
  SSF_EVENT_TYPES,
  SSF_VERIFICATION_EVENT,
  type SsfReplayStore,
} from "@auction/identity-contracts";
import { and, eq, isNull, sql } from "drizzle-orm";
import { StaleSsfSignalError } from "../services/interfaces/ssf-signal.js";

const ORDERED_SSF_JTI_VERSION = "lax-identity-outbox-v1";

function orderedJtiPrefix(subjectId: string): string {
  const subjectKey = createHash("sha256").update(subjectId).digest("base64url");
  return `${ORDERED_SSF_JTI_VERSION}.${subjectKey}.`;
}

export function readOrderedSsfEventId(jti: string, subjectId: string): number | null {
  const prefix = orderedJtiPrefix(subjectId);
  if (!jti.startsWith(prefix)) return null;
  const [eventIdText, nonce] = jti.slice(prefix.length).split(".", 2);
  const eventId = Number(eventIdText);
  return nonce && Number.isSafeInteger(eventId) && eventId > 0 ? eventId : null;
}

function mutatesBidLifecycleState(signal: NormalizedSsfSignal): boolean {
  return (
    signal.eventType === SSF_EVENT_TYPES.ACCOUNT_DISABLED ||
    signal.eventType === SSF_EVENT_TYPES.ACCOUNT_ENABLED ||
    signal.eventType === SSF_EVENT_TYPES.ACCOUNT_PURGED ||
    signal.eventType === SSF_EVENT_TYPES.LAX_IDENTITY_MERGED
  );
}

/** Atomically reserves a SET JTI and applies convergent Bid-local state. */
export function createBidSsfReplayStore(db: Database): SsfReplayStore {
  return {
    consume: async (signal, expiresAt) => {
      const outcome = await db.transaction(async (tx) => {
        const inserted = await tx
          .insert(bidSsfReplay)
          .values({ jti: signal.jti, expiresAt })
          .onConflictDoNothing()
          .returning({ jti: bidSsfReplay.jti });
        if (inserted.length === 0) return "replay" as const;
        if (mutatesBidLifecycleState(signal)) {
          const [profile] = await tx
            .select({ userId: bidUserProfile.userId })
            .from(bidUserProfile)
            .where(eq(bidUserProfile.userId, signal.subjectId))
            .for("update");
          if (!profile) return "applied" as const;

          const prefix = orderedJtiPrefix(signal.subjectId);
          const orderedRows = await tx
            .select({ jti: bidSsfReplay.jti })
            .from(bidSsfReplay)
            .where(sql`${bidSsfReplay.jti} like ${`${prefix}%`}`);
          const currentEventId = readOrderedSsfEventId(signal.jti, signal.subjectId);
          const highestEventId = orderedRows.reduce(
            (highest, row) =>
              Math.max(highest, readOrderedSsfEventId(row.jti, signal.subjectId) ?? 0),
            0,
          );

          if (currentEventId === null) {
            // Pre-ordering SETs cannot safely re-enable a subject. Once an ordered
            // SET exists, all legacy lifecycle SETs are stale relative to it.
            if (signal.eventType === SSF_EVENT_TYPES.ACCOUNT_ENABLED || highestEventId > 0) {
              return "stale" as const;
            }
          } else if (currentEventId < highestEventId) {
            return "stale" as const;
          }
        }
        await applyBidSignal(tx as Database, signal);
        return "applied" as const;
      });
      if (outcome === "stale") throw new StaleSsfSignalError();
      return outcome === "applied";
    },
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
