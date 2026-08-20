import type { Database } from "@auction/db";
import { bidIdentityDirectory, legalEntity, lot, payment } from "@auction/db/schema";
import type { AdminDisputeCaseRow } from "@auction/types";
import { inArray } from "drizzle-orm";
import type { IAdminDisputeCaseEnrichmentReader } from "../interfaces/admin-dispute-case-enrichment.reader.js";

export class DrizzleAdminDisputeCaseEnrichmentReader implements IAdminDisputeCaseEnrichmentReader {
  constructor(private readonly db: Database) {}

  async findPaymentsByIds(paymentIds: string[]) {
    if (paymentIds.length === 0) return [];
    return this.db
      .select({
        id: payment.id,
        lotId: payment.lotId,
        buyerId: payment.buyerId,
        sellerLegalEntityId: payment.sellerLegalEntityId,
      })
      .from(payment)
      .where(inArray(payment.id, paymentIds));
  }

  async findLotTitlesByIds(lotIds: string[]): Promise<Map<string, string>> {
    if (lotIds.length === 0) return new Map();
    const lotRows = await this.db
      .select({ id: lot.id, title: lot.title })
      .from(lot)
      .where(inArray(lot.id, lotIds));
    return new Map(lotRows.map((l) => [l.id, l.title] as const));
  }

  async findBuyerLabelsByIds(buyerIds: string[]): Promise<Map<string, string | null>> {
    if (buyerIds.length === 0) return new Map();
    const buyerRows = await this.db
      .select({
        id: bidIdentityDirectory.subjectId,
        name: bidIdentityDirectory.name,
        email: bidIdentityDirectory.email,
      })
      .from(bidIdentityDirectory)
      .where(inArray(bidIdentityDirectory.subjectId, buyerIds));
    return new Map(buyerRows.map((b) => [b.id, b.name?.trim() || b.email || null] as const));
  }

  async findSellerDisplayNamesByIds(sellerIds: string[]): Promise<Map<string, string>> {
    if (sellerIds.length === 0) return new Map();
    const sellerRows = await this.db
      .select({ id: legalEntity.id, displayName: legalEntity.displayName })
      .from(legalEntity)
      .where(inArray(legalEntity.id, sellerIds));
    return new Map(sellerRows.map((s) => [s.id, s.displayName] as const));
  }

  async enrichCases(cases: AdminDisputeCaseRow[]): Promise<AdminDisputeCaseRow[]> {
    if (cases.length === 0) return cases;

    const paymentIds = [...new Set(cases.map((c) => c.paymentId))];
    const paymentRows = await this.findPaymentsByIds(paymentIds);

    const paymentById = new Map(paymentRows.map((p) => [p.id, p] as const));
    const lotIds = [...new Set(paymentRows.map((p) => p.lotId))];
    const buyerIds = [...new Set(paymentRows.map((p) => p.buyerId))];
    const sellerIds = [
      ...new Set([
        ...cases.map((c) => c.sellerLegalEntityId),
        ...paymentRows.map((p) => p.sellerLegalEntityId),
      ]),
    ].filter(Boolean);

    const [lotById, buyerById, sellerById] = await Promise.all([
      this.findLotTitlesByIds(lotIds),
      this.findBuyerLabelsByIds(buyerIds),
      this.findSellerDisplayNamesByIds(sellerIds),
    ]);

    return cases.map((row) => {
      const pay = paymentById.get(row.paymentId);
      const lotId = pay?.lotId;
      const buyerId = pay?.buyerId;
      const sellerId = pay?.sellerLegalEntityId ?? row.sellerLegalEntityId;
      return {
        ...row,
        ...(lotId ? { lotId } : {}),
        ...(lotId ? { lotTitle: lotById.get(lotId) ?? lotId } : {}),
        ...(buyerId ? { buyerId } : {}),
        ...(buyerId ? { buyerLabel: buyerById.get(buyerId) ?? null } : {}),
        sellerDisplayName: sellerById.get(sellerId) ?? null,
      };
    });
  }
}
