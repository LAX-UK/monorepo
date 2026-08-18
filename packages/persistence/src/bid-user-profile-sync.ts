import type { Database } from "@auction/db";
import { bidUserProfile, user } from "@auction/db/schema";
import { eq, sql } from "drizzle-orm";

export type BidUserProfilePatch = Partial<
  Omit<typeof bidUserProfile.$inferInsert, "userId" | "createdAt">
>;

/** Emits structured migration telemetry without coupling persistence to an application logger. */
export function emitBidProfileMismatch(input: {
  userId: string;
  field: string;
  profileValue: unknown;
  legacyValue: unknown;
}): void {
  console.warn("[bid_user_profile] dual-read mismatch", input);
}

/** Idempotently ensures a Bid profile row exists for the Identity subject. */
export async function ensureBidUserProfile(db: Database, userId: string): Promise<void> {
  const [profile] = await db
    .insert(bidUserProfile)
    .select(
      db
        .select({
          userId: user.id,
          role: user.role,
          staffRole: user.staffRole,
          emailStatus: user.emailStatus,
          emailStatusChangedAt: user.emailStatusChangedAt,
          suspendedAt: user.suspendedAt,
          suspendedReason: user.suspendedReason,
          identityDisabledAt: user.identityDisabledAt,
          mergedIntoSubjectId: user.mergedIntoSubjectId,
          kycStatus: user.kycStatus,
          currentKycSessionId: user.currentKycSessionId,
          kycRetryCount: user.kycRetryCount,
          kycVerifiedAt: user.kycVerifiedAt,
          preferredPaddleNumber: user.preferredPaddleNumber,
          amlHoldStatus: user.amlHoldStatus,
          amlHoldReason: user.amlHoldReason,
          amlHoldAt: user.amlHoldAt,
          signupPersona: user.signupPersona,
          dateOfBirth: user.dateOfBirth,
          firstName: user.firstName,
          lastName: user.lastName,
          mobile: user.mobile,
          mobileCountry: user.mobileCountry,
          hasSeenActingContextTooltip: user.hasSeenActingContextTooltip,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        })
        .from(user)
        .where(eq(user.id, userId)),
    )
    .onConflictDoUpdate({
      target: bidUserProfile.userId,
      set: { userId: sql`excluded.user_id` },
    })
    .returning({ userId: bidUserProfile.userId });
  if (!profile) throw new Error(`bid_user_profile_subject_not_found:${userId}`);
}

/**
 * Writes Bid-owned fields to their authoritative profile. Migration 0140 mirrors the
 * resulting row to legacy `user` columns for old readers without granting product roles
 * direct write access to those columns.
 */
export async function writeBidUserProfile(
  db: Database,
  userId: string,
  patch: BidUserProfilePatch,
): Promise<void> {
  await ensureBidUserProfile(db, userId);
  const updatedAt = new Date();
  await db
    .update(bidUserProfile)
    .set({ ...patch, updatedAt })
    .where(eq(bidUserProfile.userId, userId));
}

/** Atomically increments the authoritative KYC retry state. */
export async function incrementBidProfileKycRetryCount(
  db: Database,
  userId: string,
): Promise<void> {
  await ensureBidUserProfile(db, userId);
  const updatedAt = new Date();
  await db
    .update(bidUserProfile)
    .set({
      kycRetryCount: sql`${bidUserProfile.kycRetryCount} + 1`,
      updatedAt,
    })
    .where(eq(bidUserProfile.userId, userId));
}
