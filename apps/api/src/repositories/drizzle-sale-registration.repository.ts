import type { Database } from "@auction/db";
import { legalEntity, legalEntityMember, saleRegistration, user } from "@auction/db/schema";
import type { LegalEntityMemberRole } from "@auction/types";
import { and, desc, eq, isNull } from "drizzle-orm";
import {
  type SaleRegistrationDbRow,
  mapSaleRegistrationRow,
} from "../services/sale-registration/sale-registration-request.mapper.js";
import type {
  ISaleRegistrationRepository,
  InsertSaleRegistrationInput,
} from "./interfaces/sale-registration.repository.js";

export class DrizzleSaleRegistrationRepository implements ISaleRegistrationRepository {
  constructor(private readonly db: Database) {}

  async listBySaleAndUser(saleId: string, userId: string) {
    const rows = await this.db
      .select()
      .from(saleRegistration)
      .where(and(eq(saleRegistration.saleId, saleId), eq(saleRegistration.userId, userId)))
      .orderBy(desc(saleRegistration.requestedAt));
    return rows.map((r) => mapSaleRegistrationRow(r));
  }

  async findBySaleUserEntity(saleId: string, userId: string, buyerLegalEntityId: string) {
    const [row] = await this.db
      .select()
      .from(saleRegistration)
      .where(
        and(
          eq(saleRegistration.saleId, saleId),
          eq(saleRegistration.userId, userId),
          eq(saleRegistration.buyerLegalEntityId, buyerLegalEntityId),
        ),
      )
      .limit(1);
    return row ? mapSaleRegistrationRow(row) : null;
  }

  async findByIdAndSale(registrationId: string, saleId: string) {
    const [row] = await this.db
      .select()
      .from(saleRegistration)
      .where(and(eq(saleRegistration.id, registrationId), eq(saleRegistration.saleId, saleId)))
      .limit(1);
    return row ? mapSaleRegistrationRow(row) : null;
  }

  async insert(input: InsertSaleRegistrationInput) {
    const [inserted] = await this.db
      .insert(saleRegistration)
      .values({
        saleId: input.saleId,
        userId: input.userId,
        buyerLegalEntityId: input.buyerLegalEntityId,
        status: "pending",
        bidLimit: input.bidLimit,
      })
      .returning();
    return inserted ? mapSaleRegistrationRow(inserted) : null;
  }

  async reactivateToPending(id: string, bidLimit: string | null) {
    const [updated] = await this.db
      .update(saleRegistration)
      .set({
        status: "pending",
        requestedAt: new Date(),
        bidLimit,
        decidedAt: null,
        decidedByUserId: null,
        rejectionReason: null,
      })
      .where(eq(saleRegistration.id, id))
      .returning();
    return updated ? mapSaleRegistrationRow(updated) : null;
  }

  async setApproved(registrationId: string, decidedByUserId: string) {
    await this.db
      .update(saleRegistration)
      .set({
        status: "approved",
        decidedAt: new Date(),
        decidedByUserId,
        rejectionReason: null,
      })
      .where(eq(saleRegistration.id, registrationId));
  }

  async setRejected(registrationId: string, decidedByUserId: string, reason: string | null) {
    await this.db
      .update(saleRegistration)
      .set({
        status: "rejected",
        decidedAt: new Date(),
        decidedByUserId,
        rejectionReason: reason,
      })
      .where(eq(saleRegistration.id, registrationId));
  }

  async updateBidLimit(registrationId: string, bidLimit: string | null, decidedByUserId: string) {
    await this.db
      .update(saleRegistration)
      .set({
        bidLimit,
        decidedAt: new Date(),
        decidedByUserId,
      })
      .where(eq(saleRegistration.id, registrationId));
  }

  async listForAdmin(input: {
    saleId: string;
    status?: "pending" | "approved" | "rejected" | "withdrawn" | undefined;
  }) {
    const conditions = [eq(saleRegistration.saleId, input.saleId)];
    if (input.status) {
      conditions.push(eq(saleRegistration.status, input.status));
    }
    const regs = await this.db
      .select({
        id: saleRegistration.id,
        saleId: saleRegistration.saleId,
        userId: saleRegistration.userId,
        buyerLegalEntityId: saleRegistration.buyerLegalEntityId,
        status: saleRegistration.status,
        requestedAt: saleRegistration.requestedAt,
        decidedAt: saleRegistration.decidedAt,
        decidedByUserId: saleRegistration.decidedByUserId,
        bidLimit: saleRegistration.bidLimit,
        paddleNumber: saleRegistration.paddleNumber,
        checkedInAt: saleRegistration.checkedInAt,
        laxNotes: saleRegistration.laxNotes,
        rejectionReason: saleRegistration.rejectionReason,
        userEmail: user.email,
        userName: user.name,
        kycStatus: user.kycStatus,
        buyerLegalEntityDisplayName: legalEntity.displayName,
        memberRole: legalEntityMember.role,
      })
      .from(saleRegistration)
      .leftJoin(user, eq(user.id, saleRegistration.userId))
      .leftJoin(legalEntity, eq(legalEntity.id, saleRegistration.buyerLegalEntityId))
      .leftJoin(
        legalEntityMember,
        and(
          eq(legalEntityMember.legalEntityId, saleRegistration.buyerLegalEntityId),
          eq(legalEntityMember.userId, saleRegistration.userId),
          isNull(legalEntityMember.removedAt),
        ),
      )
      .where(and(...conditions))
      .orderBy(desc(saleRegistration.requestedAt));

    return regs.map((r) => ({
      ...mapSaleRegistrationRow({
        id: r.id,
        saleId: r.saleId,
        userId: r.userId,
        buyerLegalEntityId: r.buyerLegalEntityId,
        status: r.status,
        requestedAt: r.requestedAt,
        decidedAt: r.decidedAt,
        decidedByUserId: r.decidedByUserId,
        bidLimit: r.bidLimit,
        laxNotes: r.laxNotes,
        rejectionReason: r.rejectionReason,
        paddleNumber: r.paddleNumber,
        checkedInAt: r.checkedInAt,
      } as SaleRegistrationDbRow),
      userEmail: r.userEmail,
      userName: r.userName,
      kycStatus: r.kycStatus,
      buyerLegalEntityDisplayName: r.buyerLegalEntityDisplayName,
      memberRole: (r.memberRole ?? null) as LegalEntityMemberRole | null,
    }));
  }
}
