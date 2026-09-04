import type { Database } from "@auction/db";
import {
  bidIdentityDirectory,
  bidUserProfile,
  legalEntity,
  legalEntityMember,
  saleRegistration,
} from "@auction/db/schema";
import { PADDLE_NUMBER_MIN } from "@auction/validators";
import { and, eq, ilike, inArray, isNotNull, isNull, or } from "drizzle-orm";
import { writeBidUserProfile } from "../bid-user-profile-sync.js";
import type {
  CheckInCandidateRow,
  CheckInWithPaddleInput,
  CheckInWithPaddleResult,
  ISaleroomCheckInRepository,
} from "../interfaces/saleroom-check-in.repository.js";
import { PaddleTakenError } from "../interfaces/saleroom-check-in.repository.js";
import { groupEligibleCheckInEntities } from "../lib/saleroom-check-in-entities.js";
import { isPaddleUniqueViolation } from "./drizzle-paddle.repository.js";

export { PaddleTakenError } from "../interfaces/saleroom-check-in.repository.js";
export type {
  CheckInCandidateEntity,
  CheckInCandidateRow,
  CheckInWithPaddleInput,
  CheckInWithPaddleResult,
  ISaleroomCheckInRepository,
} from "../interfaces/saleroom-check-in.repository.js";

export class DrizzleSaleroomCheckInRepository implements ISaleroomCheckInRepository {
  constructor(private readonly db: Database) {}

  async searchCandidates(saleId: string, q: string, limit = 10): Promise<CheckInCandidateRow[]> {
    const needle = `%${q.trim()}%`;
    const userRows = await this.db
      .select({
        id: bidIdentityDirectory.subjectId,
        name: bidIdentityDirectory.name,
        email: bidIdentityDirectory.email,
        emailVerified: bidIdentityDirectory.emailVerified,
        kycStatus: bidUserProfile.kycStatus,
        suspendedAt: bidUserProfile.suspendedAt,
      })
      .from(bidIdentityDirectory)
      .innerJoin(bidUserProfile, eq(bidUserProfile.userId, bidIdentityDirectory.subjectId))
      .where(
        or(ilike(bidIdentityDirectory.email, needle), ilike(bidIdentityDirectory.name, needle)),
      )
      .limit(limit);

    if (userRows.length === 0) return [];

    const userIds = userRows.map((u) => u.id);
    const membershipRows = await this.db
      .select({
        userId: legalEntityMember.userId,
        legalEntityId: legalEntityMember.legalEntityId,
        role: legalEntityMember.role,
        displayName: legalEntity.displayName,
        kind: legalEntity.kind,
        regStatus: saleRegistration.status,
        regPaddle: saleRegistration.paddleNumber,
        regBidLimit: saleRegistration.bidLimit,
        regCheckedInAt: saleRegistration.checkedInAt,
      })
      .from(legalEntityMember)
      .innerJoin(legalEntity, eq(legalEntity.id, legalEntityMember.legalEntityId))
      .leftJoin(
        saleRegistration,
        and(
          eq(saleRegistration.saleId, saleId),
          eq(saleRegistration.userId, legalEntityMember.userId),
          eq(saleRegistration.buyerLegalEntityId, legalEntityMember.legalEntityId),
        ),
      )
      .where(
        and(
          inArray(legalEntityMember.userId, userIds),
          isNull(legalEntityMember.removedAt),
          isNotNull(legalEntityMember.acceptedAt),
        ),
      );

    const entitiesByUser = groupEligibleCheckInEntities(membershipRows);

    const results: CheckInCandidateRow[] = [];
    for (const u of userRows) {
      const eligibleEntities = entitiesByUser.get(u.id);
      if (!eligibleEntities || eligibleEntities.length === 0) continue;
      results.push({
        userId: u.id,
        name: u.name,
        email: u.email,
        emailVerified: u.emailVerified,
        kycStatus: u.kycStatus,
        suspended: u.suspendedAt != null,
        eligibleEntities,
      });
    }

    return results;
  }

  async checkInWithPaddle(input: CheckInWithPaddleInput): Promise<CheckInWithPaddleResult> {
    try {
      return await this.db.transaction(async (tx) => {
        const now = new Date();
        const [existing] = await tx
          .select({ paddleNumber: saleRegistration.paddleNumber })
          .from(saleRegistration)
          .where(
            and(
              eq(saleRegistration.saleId, input.saleId),
              eq(saleRegistration.userId, input.userId),
              eq(saleRegistration.buyerLegalEntityId, input.buyerLegalEntityId),
            ),
          )
          .limit(1);

        // Prefer explicit paddle when assigning; otherwise keep existing on re-check-in.
        let paddleNumber: number | null;
        if (input.assignPaddle) {
          paddleNumber = input.requestedPaddleNumber ?? existing?.paddleNumber ?? null;
          if (paddleNumber == null) {
            paddleNumber = await this.nextPaddleNumber(tx, input.saleId);
          }
        } else {
          paddleNumber = existing?.paddleNumber ?? null;
        }

        // Upsert on the natural key so concurrent/double-submitted first check-ins
        // resolve to a single approved row instead of a raw unique-violation 500.
        const [row] = await tx
          .insert(saleRegistration)
          .values({
            saleId: input.saleId,
            userId: input.userId,
            buyerLegalEntityId: input.buyerLegalEntityId,
            status: "approved",
            bidLimit: input.bidLimit ?? null,
            laxNotes: input.laxNotes ?? "[staff_check_in]",
            decidedAt: now,
            decidedByUserId: input.decidedByUserId,
            requestedAt: now,
            paddleNumber,
            checkedInAt: now,
          })
          .onConflictDoUpdate({
            target: [
              saleRegistration.saleId,
              saleRegistration.userId,
              saleRegistration.buyerLegalEntityId,
            ],
            set: {
              status: "approved",
              ...(input.bidLimit !== undefined ? { bidLimit: input.bidLimit } : {}),
              ...(input.laxNotes !== undefined ? { laxNotes: input.laxNotes } : {}),
              decidedAt: now,
              decidedByUserId: input.decidedByUserId,
              rejectionReason: null,
              paddleNumber,
              checkedInAt: now,
            },
          })
          .returning({ id: saleRegistration.id });
        if (!row) throw new Error("Could not upsert sale registration");

        if (paddleNumber != null) {
          await writeBidUserProfile(tx, input.userId, {
            preferredPaddleNumber: paddleNumber,
          });
        }

        return { registrationId: row.id, paddleNumber, checkedInAt: now };
      });
    } catch (e) {
      if (isPaddleUniqueViolation(e)) throw new PaddleTakenError();
      throw e;
    }
  }

  private async nextPaddleNumber(tx: Pick<Database, "select">, saleId: string): Promise<number> {
    const rows = await tx
      .select({ paddleNumber: saleRegistration.paddleNumber })
      .from(saleRegistration)
      .where(and(eq(saleRegistration.saleId, saleId), isNotNull(saleRegistration.paddleNumber)));
    let max = PADDLE_NUMBER_MIN - 1;
    for (const r of rows) {
      if (r.paddleNumber != null && r.paddleNumber > max) max = r.paddleNumber;
    }
    return Math.max(max + 1, PADDLE_NUMBER_MIN);
  }
}
