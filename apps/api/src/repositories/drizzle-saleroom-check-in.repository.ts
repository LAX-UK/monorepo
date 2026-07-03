import type { Database } from "@auction/db";
import { legalEntity, legalEntityMember, saleRegistration, user } from "@auction/db/schema";
import { isPaddleUniqueViolation } from "@auction/persistence";
import type { LegalEntityKind, LegalEntityMemberRole } from "@auction/types";
import { PADDLE_NUMBER_MIN } from "@auction/validators";
import { and, eq, ilike, inArray, isNotNull, isNull, or } from "drizzle-orm";
import { groupEligibleCheckInEntities } from "../lib/saleroom-check-in-entities.js";

export type CheckInCandidateEntity = {
  id: string;
  displayName: string;
  role: LegalEntityMemberRole;
  kind: LegalEntityKind;
  existingRegistration: {
    status: string;
    paddleNumber: number | null;
    bidLimit: string | null;
    checkedInAt: Date | null;
  } | null;
};

export type CheckInCandidateRow = {
  userId: string;
  name: string | null;
  email: string;
  emailVerified: boolean;
  kycStatus: string;
  suspended: boolean;
  eligibleEntities: CheckInCandidateEntity[];
};

export type CheckInWithPaddleInput = {
  saleId: string;
  userId: string;
  buyerLegalEntityId: string;
  decidedByUserId: string;
  /** When false, mark present without assigning a paddle (hybrid website-first). */
  assignPaddle: boolean;
  /** Omit to preserve an existing limit on re-check-in. */
  bidLimit?: string | null;
  /** Omit to preserve existing notes on re-check-in. */
  laxNotes?: string | null;
  /** Explicit paddle from staff; null = keep existing or auto-assign next free when assignPaddle. */
  requestedPaddleNumber: number | null;
};

export type CheckInWithPaddleResult = {
  registrationId: string;
  paddleNumber: number | null;
  checkedInAt: Date;
};

/** Thrown by {@link DrizzleSaleroomCheckInRepository.checkInWithPaddle} when the requested
 * (or auto-assigned) paddle collides with another registration in the same sale. */
export class PaddleTakenError extends Error {
  readonly code = "paddle_taken" as const;
  constructor() {
    super("Paddle number is already assigned in this sale");
    this.name = "PaddleTakenError";
  }
}

export interface ISaleroomCheckInRepository {
  searchCandidates(saleId: string, q: string, limit?: number): Promise<CheckInCandidateRow[]>;
  /** Atomically upsert an approved (staff check-in) registration and assign a paddle in a single
   * transaction. Rolls back entirely on paddle conflict so staff never get a partial state. */
  checkInWithPaddle(input: CheckInWithPaddleInput): Promise<CheckInWithPaddleResult>;
}

export class DrizzleSaleroomCheckInRepository implements ISaleroomCheckInRepository {
  constructor(private readonly db: Database) {}

  async searchCandidates(saleId: string, q: string, limit = 10): Promise<CheckInCandidateRow[]> {
    const needle = `%${q.trim()}%`;
    const userRows = await this.db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        emailVerified: user.emailVerified,
        kycStatus: user.kycStatus,
        suspendedAt: user.suspendedAt,
      })
      .from(user)
      .where(or(ilike(user.email, needle), ilike(user.name, needle)))
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
          await tx
            .update(user)
            .set({ preferredPaddleNumber: paddleNumber })
            .where(eq(user.id, input.userId));
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
