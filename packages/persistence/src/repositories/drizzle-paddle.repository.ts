import type { Database } from "@auction/db";
import { bidIdentityDirectory, bidUserProfile, saleRegistration } from "@auction/db/schema";
import { and, eq, isNotNull, max } from "drizzle-orm";
import { writeBidUserProfile } from "../bid-user-profile-sync.js";
import type { IPaddleRepository, PaddleRegistrationRow } from "../interfaces/paddle.repository.js";

export class DrizzlePaddleRepository implements IPaddleRepository {
  constructor(private readonly db: Database) {}

  async findBySaleAndPaddle(
    saleId: string,
    paddleNumber: number,
  ): Promise<PaddleRegistrationRow | null> {
    const [row] = await this.db
      .select({
        registrationId: saleRegistration.id,
        saleId: saleRegistration.saleId,
        userId: saleRegistration.userId,
        buyerLegalEntityId: saleRegistration.buyerLegalEntityId,
        paddleNumber: saleRegistration.paddleNumber,
        bidLimit: saleRegistration.bidLimit,
        userName: bidIdentityDirectory.name,
        userEmail: bidIdentityDirectory.email,
        kycStatus: bidUserProfile.kycStatus,
      })
      .from(saleRegistration)
      .innerJoin(bidIdentityDirectory, eq(bidIdentityDirectory.subjectId, saleRegistration.userId))
      .innerJoin(bidUserProfile, eq(bidUserProfile.userId, saleRegistration.userId))
      .where(
        and(
          eq(saleRegistration.saleId, saleId),
          eq(saleRegistration.paddleNumber, paddleNumber),
          eq(saleRegistration.status, "approved"),
        ),
      )
      .limit(1);
    if (!row?.paddleNumber) return null;
    return {
      registrationId: row.registrationId,
      saleId: row.saleId,
      userId: row.userId,
      buyerLegalEntityId: row.buyerLegalEntityId,
      paddleNumber: row.paddleNumber,
      bidLimit: row.bidLimit,
      userName: row.userName,
      userEmail: row.userEmail,
      kycStatus: row.kycStatus,
    };
  }

  async findRegistrationById(saleId: string, registrationId: string) {
    const [row] = await this.db
      .select({
        id: saleRegistration.id,
        saleId: saleRegistration.saleId,
        userId: saleRegistration.userId,
        buyerLegalEntityId: saleRegistration.buyerLegalEntityId,
        status: saleRegistration.status,
        paddleNumber: saleRegistration.paddleNumber,
        bidLimit: saleRegistration.bidLimit,
        kycStatus: bidUserProfile.kycStatus,
        preferredPaddleNumber: bidUserProfile.preferredPaddleNumber,
      })
      .from(saleRegistration)
      .innerJoin(bidIdentityDirectory, eq(bidIdentityDirectory.subjectId, saleRegistration.userId))
      .innerJoin(bidUserProfile, eq(bidUserProfile.userId, saleRegistration.userId))
      .where(and(eq(saleRegistration.id, registrationId), eq(saleRegistration.saleId, saleId)))
      .limit(1);
    return row ?? null;
  }

  async listRosterForSale(saleId: string): Promise<PaddleRegistrationRow[]> {
    const rows = await this.db
      .select({
        registrationId: saleRegistration.id,
        saleId: saleRegistration.saleId,
        userId: saleRegistration.userId,
        buyerLegalEntityId: saleRegistration.buyerLegalEntityId,
        paddleNumber: saleRegistration.paddleNumber,
        bidLimit: saleRegistration.bidLimit,
        userName: bidIdentityDirectory.name,
        userEmail: bidIdentityDirectory.email,
        kycStatus: bidUserProfile.kycStatus,
      })
      .from(saleRegistration)
      .innerJoin(bidIdentityDirectory, eq(bidIdentityDirectory.subjectId, saleRegistration.userId))
      .innerJoin(bidUserProfile, eq(bidUserProfile.userId, saleRegistration.userId))
      .where(
        and(
          eq(saleRegistration.saleId, saleId),
          eq(saleRegistration.status, "approved"),
          isNotNull(saleRegistration.paddleNumber),
        ),
      )
      .orderBy(saleRegistration.paddleNumber);
    return rows
      .filter((r) => r.paddleNumber != null)
      .map((r) => ({
        registrationId: r.registrationId,
        saleId: r.saleId,
        userId: r.userId,
        buyerLegalEntityId: r.buyerLegalEntityId,
        paddleNumber: r.paddleNumber as number,
        bidLimit: r.bidLimit,
        userName: r.userName,
        userEmail: r.userEmail,
        kycStatus: r.kycStatus,
      }));
  }

  async nextPaddleNumber(saleId: string): Promise<number> {
    const [row] = await this.db
      .select({ maxNum: max(saleRegistration.paddleNumber) })
      .from(saleRegistration)
      .where(and(eq(saleRegistration.saleId, saleId), isNotNull(saleRegistration.paddleNumber)));
    const current = row?.maxNum ?? null;
    if (current == null) return 100;
    return Math.max(current + 1, 100);
  }

  async isPaddleFree(saleId: string, paddleNumber: number): Promise<boolean> {
    const [row] = await this.db
      .select({ id: saleRegistration.id })
      .from(saleRegistration)
      .where(
        and(eq(saleRegistration.saleId, saleId), eq(saleRegistration.paddleNumber, paddleNumber)),
      )
      .limit(1);
    return !row;
  }

  async assignPaddle(input: {
    registrationId: string;
    paddleNumber: number;
    checkedInAt: Date;
  }): Promise<void> {
    await this.db
      .update(saleRegistration)
      .set({
        paddleNumber: input.paddleNumber,
        checkedInAt: input.checkedInAt,
      })
      .where(eq(saleRegistration.id, input.registrationId));
  }

  async clearPaddle(registrationId: string): Promise<void> {
    await this.db
      .update(saleRegistration)
      .set({ paddleNumber: null, checkedInAt: null })
      .where(eq(saleRegistration.id, registrationId));
  }

  async updatePreferredPaddle(userId: string, paddleNumber: number): Promise<void> {
    await writeBidUserProfile(this.db, userId, { preferredPaddleNumber: paddleNumber });
  }
}

/** Detect Postgres unique violation on sale paddle assignment. */
export function isPaddleUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = "code" in error ? String((error as { code?: string }).code) : "";
  if (code !== "23505") return false;
  const msg = "message" in error ? String((error as { message?: string }).message) : "";
  return msg.includes("sale_registration_sale_paddle") || msg.includes("paddle");
}
