import type { Database } from "@auction/db";
import {
  legalEntity,
  privateSaleDeal,
  privateSaleDealDocument,
  privateSaleDealParty,
  privateSaleDealStageHistory,
} from "@auction/db/schema";
import type {
  PrivateSaleDealDetail,
  PrivateSaleDealDocument,
  PrivateSaleDealParty,
  PrivateSaleDealStage,
  PrivateSaleDocumentAudience,
  PrivateSaleDocumentKind,
  PrivateSalePartyRole,
  PrivateSaleStageChange,
  PrivateSaleStageHistoryEntry,
} from "@auction/types";
import { and, asc, eq, sql } from "drizzle-orm";
import type {
  IPrivateSaleDealReader,
  IPrivateSaleDealWriter,
  IPrivateSaleDocumentWriter,
  NewPrivateSaleDeal,
  NewPrivateSaleDocument,
  PrivateSaleDealTermsPatch,
  PrivateSaleDealWriteResult,
} from "../interfaces/private-sale-deal.repository.js";

type DealRow = typeof privateSaleDeal.$inferSelect;
type DocumentRow = typeof privateSaleDealDocument.$inferSelect;

function mapDocument(row: DocumentRow): PrivateSaleDealDocument {
  return {
    id: row.id,
    dealId: row.dealId,
    kind: row.kind as PrivateSaleDocumentKind,
    audience: row.audience as PrivateSaleDocumentAudience,
    legalEntityId: row.legalEntityId,
    version: row.version,
    uploadObjectId: row.uploadObjectId,
    acceptedAt: row.acceptedAt,
    acceptedByUserId: row.acceptedByUserId,
    createdByUserId: row.createdByUserId,
    createdAt: row.createdAt,
  };
}

function mapDeal(row: DealRow): Omit<PrivateSaleDealDetail, "seller" | "buyer" | "documents"> {
  return {
    id: row.id,
    reference: row.reference,
    stage: row.stage as PrivateSaleDealStage,
    itemSubmissionId: row.itemSubmissionId,
    artworkRegisterId: row.artworkRegisterId,
    sourceEnquiryId: row.sourceEnquiryId,
    sourceUnsoldLotChoiceId: row.sourceUnsoldLotChoiceId,
    ownerUserId: row.ownerUserId,
    priceMinor: row.priceMinor,
    buyerFeeBps: row.buyerFeeBps,
    sellerCommissionBps: row.sellerCommissionBps,
    costsMinor: row.costsMinor,
    vatTreatment: row.vatTreatment,
    partiesDisclosed: row.partiesDisclosed,
    offerExpiresAt: row.offerExpiresAt,
    paymentDueAt: row.paymentDueAt,
    collectionDueAt: row.collectionDueAt,
    agreedAt: row.agreedAt,
    agreedByUserId: row.agreedByUserId,
    invoicedByUserId: row.invoicedByUserId,
    invoiceReference: row.invoiceReference,
    cancelReason: row.cancelReason,
    cancelledAt: row.cancelledAt,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** Private sale deals: the deal with its parties and documents, its stage history, and the writes that change them. */
export class DrizzlePrivateSaleDealRepository
  implements IPrivateSaleDealReader, IPrivateSaleDealWriter, IPrivateSaleDocumentWriter
{
  constructor(private readonly db: Database) {}

  async findById(id: string): Promise<PrivateSaleDealDetail | null> {
    return this.load(this.db, eq(privateSaleDeal.id, id));
  }

  async findByReference(reference: string): Promise<PrivateSaleDealDetail | null> {
    return this.load(this.db, eq(privateSaleDeal.reference, reference));
  }

  async history(dealId: string): Promise<PrivateSaleStageHistoryEntry[]> {
    const rows = await this.db
      .select()
      .from(privateSaleDealStageHistory)
      .where(eq(privateSaleDealStageHistory.dealId, dealId))
      .orderBy(asc(privateSaleDealStageHistory.createdAt), asc(privateSaleDealStageHistory.id));
    return rows.map((row) => ({
      id: row.id,
      dealId: row.dealId,
      fromStage: row.fromStage as PrivateSaleDealStage | null,
      toStage: row.toStage as PrivateSaleDealStage,
      actorUserId: row.actorUserId,
      reason: row.reason,
      createdAt: row.createdAt,
    }));
  }

  async create(input: NewPrivateSaleDeal): Promise<PrivateSaleDealDetail> {
    return this.db.transaction(async (tx) => {
      const [row] = await tx
        .insert(privateSaleDeal)
        .values({
          itemSubmissionId: input.itemSubmissionId,
          artworkRegisterId: input.artworkRegisterId ?? null,
          sourceEnquiryId: input.sourceEnquiryId ?? null,
          sourceUnsoldLotChoiceId: input.sourceUnsoldLotChoiceId ?? null,
          ownerUserId: input.ownerUserId,
          buyerFeeBps: input.buyerFeeBps,
          sellerCommissionBps: input.sellerCommissionBps,
        })
        .returning();
      if (!row) throw new Error("private sale deal was not created");
      const parties = [
        { role: "seller", ...input.seller },
        ...(input.buyer ? [{ role: "buyer", ...input.buyer }] : []),
      ];
      await tx.insert(privateSaleDealParty).values(
        parties.map((party) => ({
          dealId: row.id,
          role: party.role,
          legalEntityId: party.legalEntityId,
          actingUserId: party.actingUserId,
        })),
      );
      await tx.insert(privateSaleDealStageHistory).values({
        dealId: row.id,
        fromStage: null,
        toStage: "proposed",
        actorUserId: input.actorUserId,
        // The wall clock, not the transaction start: entries written in one transaction keep their order.
        createdAt: sql`clock_timestamp()`,
      });
      const deal = await this.load(tx, eq(privateSaleDeal.id, row.id));
      if (!deal) throw new Error("private sale deal was not readable after it was created");
      return deal;
    });
  }

  async setParty(
    dealId: string,
    expectedVersion: number,
    party: { role: PrivateSalePartyRole; legalEntityId: string; actingUserId: string | null },
  ): Promise<PrivateSaleDealWriteResult> {
    return this.db.transaction(async (tx) => {
      if (!(await this.bumpVersion(tx, dealId, expectedVersion, {}))) {
        return this.missOrConflict(tx, dealId);
      }
      await tx
        .insert(privateSaleDealParty)
        .values({
          dealId,
          role: party.role,
          legalEntityId: party.legalEntityId,
          actingUserId: party.actingUserId,
        })
        .onConflictDoUpdate({
          target: [privateSaleDealParty.dealId, privateSaleDealParty.role],
          set: {
            legalEntityId: party.legalEntityId,
            actingUserId: party.actingUserId,
            updatedAt: sql`now()`,
          },
        });
      return this.okOf(tx, dealId);
    });
  }

  async updateTerms(
    dealId: string,
    expectedVersion: number,
    patch: PrivateSaleDealTermsPatch,
  ): Promise<PrivateSaleDealWriteResult> {
    return this.db.transaction(async (tx) => {
      if (!(await this.bumpVersion(tx, dealId, expectedVersion, patch))) {
        return this.missOrConflict(tx, dealId);
      }
      return this.okOf(tx, dealId);
    });
  }

  async applyStageChange(
    dealId: string,
    expectedVersion: number,
    change: PrivateSaleStageChange,
  ): Promise<PrivateSaleDealWriteResult> {
    return this.db.transaction(async (tx) => {
      const updated = await tx
        .update(privateSaleDeal)
        .set({
          ...change.changes,
          stage: change.to,
          version: sql`${privateSaleDeal.version} + 1`,
          updatedAt: sql`now()`,
        })
        .where(
          and(
            eq(privateSaleDeal.id, dealId),
            eq(privateSaleDeal.version, expectedVersion),
            eq(privateSaleDeal.stage, change.from),
          ),
        )
        .returning({ id: privateSaleDeal.id });
      if (updated.length === 0) return this.missOrConflict(tx, dealId);
      await tx.insert(privateSaleDealStageHistory).values({
        dealId,
        fromStage: change.from,
        toStage: change.to,
        actorUserId: change.actorUserId,
        reason: change.reason,
        createdAt: sql`clock_timestamp()`,
      });
      return this.okOf(tx, dealId);
    });
  }

  async add(input: NewPrivateSaleDocument): Promise<PrivateSaleDealDocument> {
    const [row] = await this.db
      .insert(privateSaleDealDocument)
      .values({
        dealId: input.dealId,
        kind: input.kind,
        audience: input.audience,
        legalEntityId: input.legalEntityId,
        version: input.version,
        uploadObjectId: input.uploadObjectId,
        createdByUserId: input.createdByUserId,
        createdAt: sql`clock_timestamp()`,
      })
      .returning();
    if (!row) throw new Error("private sale document was not created");
    return mapDocument(row);
  }

  async recordAcceptance(input: {
    dealId: string;
    kind: "terms" | "nda";
    legalEntityId: string;
    version: string;
    userId: string;
    at: Date;
  }): Promise<PrivateSaleDealDocument> {
    const [inserted] = await this.db
      .insert(privateSaleDealDocument)
      .values({
        dealId: input.dealId,
        kind: input.kind,
        audience: "both",
        legalEntityId: input.legalEntityId,
        version: input.version,
        acceptedAt: input.at,
        acceptedByUserId: input.userId,
        createdByUserId: input.userId,
        createdAt: sql`clock_timestamp()`,
      })
      .onConflictDoNothing()
      .returning();
    if (inserted) return mapDocument(inserted);
    const [existing] = await this.db
      .select()
      .from(privateSaleDealDocument)
      .where(
        and(
          eq(privateSaleDealDocument.dealId, input.dealId),
          eq(privateSaleDealDocument.legalEntityId, input.legalEntityId),
          eq(privateSaleDealDocument.kind, input.kind),
          eq(privateSaleDealDocument.version, input.version),
          sql`${privateSaleDealDocument.acceptedAt} IS NOT NULL`,
        ),
      );
    if (!existing) throw new Error("private sale acceptance was neither recorded nor found");
    return mapDocument(existing);
  }

  /** Writes the patch and bumps the version, only if nobody changed the deal since it was read. */
  private async bumpVersion(
    tx: Database,
    dealId: string,
    expectedVersion: number,
    patch: PrivateSaleDealTermsPatch,
  ): Promise<boolean> {
    const updated = await tx
      .update(privateSaleDeal)
      .set({ ...patch, version: sql`${privateSaleDeal.version} + 1`, updatedAt: sql`now()` })
      .where(and(eq(privateSaleDeal.id, dealId), eq(privateSaleDeal.version, expectedVersion)))
      .returning({ id: privateSaleDeal.id });
    return updated.length > 0;
  }

  private async missOrConflict(tx: Database, dealId: string): Promise<PrivateSaleDealWriteResult> {
    const [row] = await tx
      .select({ id: privateSaleDeal.id })
      .from(privateSaleDeal)
      .where(eq(privateSaleDeal.id, dealId));
    return row ? { kind: "conflict" } : { kind: "not_found" };
  }

  private async okOf(tx: Database, dealId: string): Promise<PrivateSaleDealWriteResult> {
    const deal = await this.load(tx, eq(privateSaleDeal.id, dealId));
    return deal ? { kind: "ok", deal } : { kind: "not_found" };
  }

  private async load(
    db: Database,
    where: ReturnType<typeof eq>,
  ): Promise<PrivateSaleDealDetail | null> {
    const [row] = await db.select().from(privateSaleDeal).where(where);
    if (!row) return null;
    const [partyRows, documentRows] = await Promise.all([
      db
        .select({
          role: privateSaleDealParty.role,
          legalEntityId: privateSaleDealParty.legalEntityId,
          actingUserId: privateSaleDealParty.actingUserId,
          displayName: legalEntity.displayName,
        })
        .from(privateSaleDealParty)
        .innerJoin(legalEntity, eq(legalEntity.id, privateSaleDealParty.legalEntityId))
        .where(eq(privateSaleDealParty.dealId, row.id)),
      db
        .select()
        .from(privateSaleDealDocument)
        .where(eq(privateSaleDealDocument.dealId, row.id))
        .orderBy(asc(privateSaleDealDocument.createdAt), asc(privateSaleDealDocument.id)),
    ]);
    const party = (role: PrivateSalePartyRole): PrivateSaleDealParty | null => {
      const found = partyRows.find((p) => p.role === role);
      return found
        ? {
            role,
            legalEntityId: found.legalEntityId,
            displayName: found.displayName,
            actingUserId: found.actingUserId,
          }
        : null;
    };
    const seller = party("seller");
    if (!seller) throw new Error(`private sale deal ${row.reference} has no seller`);
    return {
      ...mapDeal(row),
      seller,
      buyer: party("buyer"),
      documents: documentRows.map(mapDocument),
    };
  }
}
