import { randomUUID } from "node:crypto";
import type { Database } from "@auction/db";
import { lotReoffer, sellerConsent } from "@auction/db/schema";
import { REOFFER_STATUSES, type ReofferRecord, isOpenReofferStatus } from "@auction/domain";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import {
  type CreateLotReofferInput,
  type ILotReofferReader,
  type ILotReofferRepository,
  type ISellerConsentRepository,
  LotReofferConflictError,
  type LotReofferView,
  type ReofferStatusChange,
  type SellerConsentAnswerWrite,
  type SellerConsentView,
} from "../interfaces/lot-reoffer.js";
import { toLotReofferView, toReofferRecord, toSellerConsentView } from "./lot-reoffer.mappers.js";

/** Statuses in which an offer is still waiting on someone: the partial unique index covers these. */
const OPEN_STATUSES = REOFFER_STATUSES.filter(isOpenReofferStatus);

function isUniqueViolation(error: unknown): boolean {
  const code = (error as { code?: string; cause?: { code?: string } } | null) ?? null;
  return code?.code === "23505" || code?.cause?.code === "23505";
}

export class DrizzleLotReofferReader implements ILotReofferReader {
  constructor(private readonly db: Database) {}

  async findById(id: string): Promise<LotReofferView | null> {
    const [row] = await this.db.select().from(lotReoffer).where(eq(lotReoffer.id, id)).limit(1);
    return row ? toLotReofferView(row) : null;
  }

  async listForDefault(buyerDefaultId: string): Promise<LotReofferView[]> {
    const rows = await this.db
      .select()
      .from(lotReoffer)
      .where(eq(lotReoffer.buyerDefaultId, buyerDefaultId))
      .orderBy(asc(lotReoffer.sequence));
    return rows.map(toLotReofferView);
  }

  async findOpenForLot(lotId: string): Promise<LotReofferView | null> {
    const [row] = await this.db
      .select()
      .from(lotReoffer)
      .where(and(eq(lotReoffer.lotId, lotId), inArray(lotReoffer.status, [...OPEN_STATUSES])))
      .limit(1);
    return row ? toLotReofferView(row) : null;
  }
}

export class DrizzleLotReofferRepository implements ILotReofferRepository {
  async create(
    tx: Database,
    input: CreateLotReofferInput,
  ): Promise<{ id: string; consentId: string }> {
    // The consent names the offer it is about, so the offer's id is chosen first.
    const id = randomUUID();
    try {
      const [consent] = await tx
        .insert(sellerConsent)
        .values({
          subjectType: "lot_reoffer",
          subjectId: id,
          sellerLegalEntityId: input.sellerLegalEntityId,
          lotId: input.lotId,
          termsSnapshot: input.consent.terms,
          status: input.consent.status,
          channel: input.consent.channel,
          requestedAt: input.consent.requestedAt,
          dueAt: input.consent.dueAt,
        })
        .returning({ id: sellerConsent.id });
      if (!consent) throw new LotReofferConflictError();
      await tx.insert(lotReoffer).values({
        id,
        lotId: input.lotId,
        buyerDefaultId: input.buyerDefaultId,
        sequence: input.sequence,
        offeredUserId: input.offeredUserId,
        offeredLegalEntityId: input.offeredLegalEntityId,
        sourceBidId: input.sourceBidId,
        amountPence: input.amountPence,
        status: input.status,
        sellerConsentId: consent.id,
        createdBy: input.createdBy,
      });
      return { id, consentId: consent.id };
    } catch (error) {
      if (isUniqueViolation(error)) throw new LotReofferConflictError();
      throw error;
    }
  }

  async changeStatus(tx: Database, change: ReofferStatusChange): Promise<void> {
    const updated = await tx
      .update(lotReoffer)
      .set({
        status: change.to,
        updatedAt: new Date(),
        ...(change.offerSentAt !== undefined && { offerSentAt: change.offerSentAt }),
        ...(change.offerEndsAt !== undefined && { offerEndsAt: change.offerEndsAt }),
        ...(change.respondedAt !== undefined && { respondedAt: change.respondedAt }),
        ...(change.declineReason !== undefined && { declineReason: change.declineReason }),
        ...(change.closedBy !== undefined && { closedBy: change.closedBy }),
        ...(change.closeReason !== undefined && { closeReason: change.closeReason }),
      })
      .where(and(eq(lotReoffer.id, change.id), eq(lotReoffer.status, change.from)))
      .returning({ id: lotReoffer.id });
    if (updated.length === 0) throw new LotReofferConflictError();
  }

  async recordsForDefault(tx: Database, buyerDefaultId: string): Promise<ReofferRecord[]> {
    const rows = await tx
      .select({ status: lotReoffer.status, offerSentAt: lotReoffer.offerSentAt })
      .from(lotReoffer)
      .where(eq(lotReoffer.buyerDefaultId, buyerDefaultId))
      .orderBy(asc(lotReoffer.sequence));
    return rows.map(toReofferRecord);
  }
}

export class DrizzleSellerConsentRepository implements ISellerConsentRepository {
  constructor(private readonly db: Database) {}

  async findById(id: string): Promise<SellerConsentView | null> {
    const [row] = await this.db
      .select()
      .from(sellerConsent)
      .where(eq(sellerConsent.id, id))
      .limit(1);
    return row ? toSellerConsentView(row) : null;
  }

  async findForReoffer(reofferId: string): Promise<SellerConsentView | null> {
    const [row] = await this.db
      .select()
      .from(sellerConsent)
      .where(
        and(eq(sellerConsent.subjectType, "lot_reoffer"), eq(sellerConsent.subjectId, reofferId)),
      )
      .limit(1);
    return row ? toSellerConsentView(row) : null;
  }

  async answer(tx: Database, write: SellerConsentAnswerWrite): Promise<void> {
    const updated = await tx
      .update(sellerConsent)
      .set({
        status: write.to,
        channel: write.channel,
        answeredByUserId: write.answeredByUserId,
        answeredAt: write.answeredAt,
        note: write.note,
        preferredNext: write.preferredNext,
      })
      .where(and(eq(sellerConsent.id, write.id), eq(sellerConsent.status, write.from)))
      .returning({ id: sellerConsent.id });
    if (updated.length === 0) throw new LotReofferConflictError();
  }

  async markReminded(id: string, remindedAt: Date): Promise<boolean> {
    const updated = await this.db
      .update(sellerConsent)
      .set({ remindedAt })
      .where(
        and(
          eq(sellerConsent.id, id),
          eq(sellerConsent.status, "requested"),
          isNull(sellerConsent.remindedAt),
        ),
      )
      .returning({ id: sellerConsent.id });
    return updated.length > 0;
  }
}
