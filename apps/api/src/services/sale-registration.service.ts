import type { Database } from "@auction/db";
import { saleNotDeleted } from "@auction/db";
import { legalEntity, legalEntityMember, sale, saleRegistration, user } from "@auction/db/schema";
import type { LegalEntityMemberRole } from "@auction/types";
import { and, desc, eq, isNull } from "drizzle-orm";
import { type Result, err, ok } from "neverthrow";
import { memberRequiresSaleRegistration } from "../lib/sale-registration-policy.js";
import type { ILegalEntityRepository } from "./interfaces/legal-entity-repository.js";

export type SaleRegistrationRow = {
  id: string;
  saleId: string;
  userId: string;
  buyerLegalEntityId: string;
  status: "pending" | "approved" | "rejected" | "withdrawn";
  requestedAt: Date;
  decidedAt: Date | null;
  decidedByUserId: string | null;
  bidLimit: string | null;
  paddleNumber: number | null;
  checkedInAt: Date | null;
  laxNotes: string | null;
  rejectionReason: string | null;
};

export type SaleRegistrationAdminRow = SaleRegistrationRow & {
  userEmail: string | null;
  userName: string | null;
  buyerLegalEntityDisplayName: string | null;
  /** Current membership role for (buyerLegalEntityId, userId); null if no active row. */
  memberRole: LegalEntityMemberRole | null;
  kycStatus: string | null;
};

export type SaleRegistrationServiceError = {
  message: string;
  status: number;
  code?: string;
};

function toBidLimitString(n: number | undefined): string | null {
  if (n == null || !Number.isFinite(n)) return null;
  return n.toFixed(2);
}

export class SaleRegistrationService {
  constructor(
    private readonly db: Database,
    private readonly legalEntityRepository: ILegalEntityRepository,
  ) {}

  async listMineForSale(input: { userId: string; saleId: string }): Promise<SaleRegistrationRow[]> {
    const rows = await this.db
      .select()
      .from(saleRegistration)
      .where(
        and(eq(saleRegistration.saleId, input.saleId), eq(saleRegistration.userId, input.userId)),
      )
      .orderBy(desc(saleRegistration.requestedAt));
    return rows.map((r) => this.mapRow(r));
  }

  async requestRegistration(input: {
    userId: string;
    saleId: string;
    buyerLegalEntityId: string;
    bidLimit?: number | undefined;
  }): Promise<Result<SaleRegistrationRow, SaleRegistrationServiceError>> {
    const [saleRow] = await this.db
      .select({ id: sale.id, status: sale.status })
      .from(sale)
      .where(and(eq(sale.id, input.saleId), saleNotDeleted()))
      .limit(1);
    if (!saleRow) {
      return err({ message: "Sale not found", status: 404 });
    }
    if (saleRow.status !== "scheduled" && saleRow.status !== "active") {
      return err({
        message: "This sale is not open for bidder registration",
        status: 400,
        code: "sale_not_registerable",
      });
    }

    const membership = await this.legalEntityRepository.findActiveMembership(
      input.userId,
      input.buyerLegalEntityId,
    );
    if (!membership) {
      return err({ message: "Not a member of the selected legal entity", status: 403 });
    }

    if (!memberRequiresSaleRegistration(membership.role)) {
      return err({
        message: "Sale registration is not required for this membership",
        status: 400,
        code: "no_registration_required",
      });
    }

    const entity = await this.legalEntityRepository.findById(input.buyerLegalEntityId);
    if (!entity) {
      return err({ message: "Legal entity not found", status: 404 });
    }
    if (entity.status !== "approved" && entity.status !== "restricted") {
      return err({
        message: "Legal entity is not authorised to register for bidding",
        status: 403,
        code: "entity_not_authorised",
      });
    }

    const bidLimitStr = toBidLimitString(input.bidLimit);

    const [existing] = await this.db
      .select()
      .from(saleRegistration)
      .where(
        and(
          eq(saleRegistration.saleId, input.saleId),
          eq(saleRegistration.userId, input.userId),
          eq(saleRegistration.buyerLegalEntityId, input.buyerLegalEntityId),
        ),
      )
      .limit(1);

    if (existing) {
      if (existing.status === "approved" || existing.status === "pending") {
        return ok(this.mapRow(existing));
      }
      const [updated] = await this.db
        .update(saleRegistration)
        .set({
          status: "pending",
          requestedAt: new Date(),
          bidLimit: bidLimitStr,
          decidedAt: null,
          decidedByUserId: null,
          rejectionReason: null,
        })
        .where(eq(saleRegistration.id, existing.id))
        .returning();
      if (!updated) {
        return err({ message: "Could not update sale registration", status: 500 });
      }
      return ok(this.mapRow(updated));
    }

    const [inserted] = await this.db
      .insert(saleRegistration)
      .values({
        saleId: input.saleId,
        userId: input.userId,
        buyerLegalEntityId: input.buyerLegalEntityId,
        status: "pending",
        bidLimit: bidLimitStr,
      })
      .returning();

    if (!inserted) {
      return err({ message: "Could not create sale registration", status: 500 });
    }
    return ok(this.mapRow(inserted));
  }

  async listForSaleAdmin(input: {
    saleId: string;
    status?: "pending" | "approved" | "rejected" | "withdrawn" | undefined;
  }): Promise<SaleRegistrationAdminRow[]> {
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
      ...this.mapRow({
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
      } as typeof saleRegistration.$inferSelect),
      userEmail: r.userEmail,
      userName: r.userName,
      kycStatus: r.kycStatus,
      buyerLegalEntityDisplayName: r.buyerLegalEntityDisplayName,
      memberRole: (r.memberRole ?? null) as LegalEntityMemberRole | null,
    }));
  }

  async approve(input: {
    saleId: string;
    registrationId: string;
    decidedByUserId: string;
  }): Promise<Result<void, SaleRegistrationServiceError>> {
    const [row] = await this.db
      .select()
      .from(saleRegistration)
      .where(
        and(
          eq(saleRegistration.id, input.registrationId),
          eq(saleRegistration.saleId, input.saleId),
        ),
      )
      .limit(1);
    if (!row) {
      return err({ message: "Registration not found", status: 404 });
    }
    if (row.status !== "pending") {
      return err({ message: "Only pending registrations can be approved", status: 400 });
    }
    await this.db
      .update(saleRegistration)
      .set({
        status: "approved",
        decidedAt: new Date(),
        decidedByUserId: input.decidedByUserId,
        rejectionReason: null,
      })
      .where(eq(saleRegistration.id, input.registrationId));
    return ok(undefined);
  }

  async reject(input: {
    saleId: string;
    registrationId: string;
    decidedByUserId: string;
    reason?: string | undefined;
  }): Promise<Result<void, SaleRegistrationServiceError>> {
    const [row] = await this.db
      .select()
      .from(saleRegistration)
      .where(
        and(
          eq(saleRegistration.id, input.registrationId),
          eq(saleRegistration.saleId, input.saleId),
        ),
      )
      .limit(1);
    if (!row) {
      return err({ message: "Registration not found", status: 404 });
    }
    if (row.status !== "pending") {
      return err({ message: "Only pending registrations can be rejected", status: 400 });
    }
    await this.db
      .update(saleRegistration)
      .set({
        status: "rejected",
        decidedAt: new Date(),
        decidedByUserId: input.decidedByUserId,
        rejectionReason: input.reason ?? null,
      })
      .where(eq(saleRegistration.id, input.registrationId));
    return ok(undefined);
  }

  private mapRow(r: typeof saleRegistration.$inferSelect): SaleRegistrationRow {
    return {
      id: r.id,
      saleId: r.saleId,
      userId: r.userId,
      buyerLegalEntityId: r.buyerLegalEntityId,
      status: r.status as SaleRegistrationRow["status"],
      requestedAt: r.requestedAt,
      decidedAt: r.decidedAt,
      decidedByUserId: r.decidedByUserId,
      bidLimit: r.bidLimit,
      laxNotes: r.laxNotes,
      rejectionReason: r.rejectionReason,
      paddleNumber: r.paddleNumber,
      checkedInAt: r.checkedInAt,
    };
  }
}
