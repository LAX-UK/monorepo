import type { Database } from "@auction/db";
import { bidIdentityDirectory, bidUserProfile } from "@auction/db/schema";
import { eq, sql } from "drizzle-orm";

export type BidUserProfilePatch = Partial<
  Omit<typeof bidUserProfile.$inferInsert, "userId" | "createdAt">
>;

/**
 * Provisions the minimal Bid-owned profile shell from a trusted Identity
 * subject and timestamp. This does not replicate Identity directory data.
 */
export async function provisionBidUserProfileShell(
  db: Database,
  userId: string,
  createdAt: Date,
): Promise<void> {
  await db
    .insert(bidUserProfile)
    .values({ userId, createdAt, updatedAt: createdAt })
    .onConflictDoNothing({ target: bidUserProfile.userId });
}

/** Idempotently ensures a Bid profile row exists for the Identity subject. */
export async function ensureBidUserProfile(db: Database, userId: string): Promise<void> {
  const [existing] = await db
    .select({ userId: bidUserProfile.userId })
    .from(bidUserProfile)
    .where(eq(bidUserProfile.userId, userId));
  if (existing) return;

  const [subject] = await db
    .select({
      userId: bidIdentityDirectory.subjectId,
      mergedIntoSubjectId: bidIdentityDirectory.mergedIntoSubjectId,
      createdAt: bidIdentityDirectory.identityCreatedAt,
      updatedAt: bidIdentityDirectory.replicatedAt,
    })
    .from(bidIdentityDirectory)
    .where(eq(bidIdentityDirectory.subjectId, userId));
  if (!subject) throw new Error(`bid_user_profile_subject_not_found:${userId}`);

  await db
    .insert(bidUserProfile)
    .values(subject)
    .onConflictDoUpdate({
      target: bidUserProfile.userId,
      set: { userId: sql`excluded.user_id` },
    });
}

/**
 * Writes Bid-owned fields to their authoritative profile in `bid_user_profile`.
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
