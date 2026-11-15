import {
  type BidPayoutFacts,
  type BidPayoutSaleFacts,
  type ShopArtistPayoutFacts,
  type ShopPayoutSource,
  vatForLine,
} from "@auction/accounting-domain";
import { LONDON_TIME_ZONE, dayKey } from "@auction/datetime";
import type { Database } from "@auction/db";
import {
  legalEntity,
  payout,
  payoutLine,
  saleSellerTerms,
  shopParty,
  shopPayoutLedger,
} from "@auction/db/schema";
import { SHOP_CONNECT_TRANSFER_ACTOR } from "@auction/types";
import { asc, eq, sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import type { FactsRead, IPayoutAccountingFactsReader } from "../../interfaces/accounting.js";

const skip = (reason: string) => ({ status: "skip", reason }) as const;
const ready = <T>(facts: T) => ({ status: "ready", facts }) as const;
const londonDay = (instant: Date) => dayKey(instant, LONDON_TIME_ZONE);
/** numeric(18,2) pounds to whole pence in the database: exact, no floating point. */
const pence = (column: AnyPgColumn) => sql<string>`(${column} * 100)::bigint`;

const VAT_TREATMENTS = new Set(["standard", "not_registered"]);

/** The VAT on commission is what the rule makes of the commission at the snapshot's own rate. */
function commissionVatAgrees(line: {
  commissionPence: number | null;
  commissionVatTreatment: string | null;
  commissionVatBps: number | null;
  commissionVatPence: number | null;
}): boolean {
  if (line.commissionPence === null || line.commissionVatBps === null) return false;
  const charged = vatForLine(
    line.commissionPence,
    line.commissionVatTreatment === "standard" ? "standard" : "outside_scope",
    line.commissionVatBps,
  );
  return charged.ok && charged.value === line.commissionVatPence;
}

/**
 * The stored rows behind the payout flows. Read-only. A Bid payout is read with every line it holds:
 * a lot sale with its seller-terms snapshot (its line's amount is the snapshot's hammer) is
 * itemised; anything else (a refund or adjustment, a private sale, a sale with no usable snapshot)
 * is counted, never guessed at, so the bill is parked for a person.
 */
export class DrizzlePayoutAccountingFactsReader implements IPayoutAccountingFactsReader {
  constructor(private readonly db: Database) {}

  async bidPayout(payoutId: string): Promise<FactsRead<BidPayoutFacts>> {
    const [row] = await this.db
      .select({
        id: payout.id,
        legalEntityId: payout.legalEntityId,
        displayName: legalEntity.displayName,
        legalName: legalEntity.legalName,
        createdAt: payout.createdAt,
        currency: payout.currency,
        status: payout.status,
        grossPence: pence(payout.grossAmount),
        platformFeePence: pence(payout.platformFee),
        stripeFeePence: pence(payout.stripeFee),
        netPence: pence(payout.netAmount),
        stripeTransferId: payout.stripeTransferId,
        processedAt: payout.processedAt,
      })
      .from(payout)
      .innerJoin(legalEntity, eq(legalEntity.id, payout.legalEntityId))
      .where(eq(payout.id, payoutId));
    if (!row) return skip("payout_not_found");
    if (row.currency !== "GBP") return skip("not_in_pounds");
    // Nothing owed (a payout netted to zero or below goes to a clawback): nothing is billed.
    if (Number(row.netPence) <= 0) return skip("payout_nothing_owed");
    const lines = await this.db
      .select({
        kind: payoutLine.kind,
        paymentId: payoutLine.paymentId,
        amountPence: pence(payoutLine.amount),
        termsId: saleSellerTerms.id,
        lotId: saleSellerTerms.lotId,
        sellerLegalEntityId: saleSellerTerms.sellerLegalEntityId,
        basis: saleSellerTerms.basis,
        agreementId: saleSellerTerms.agreementId,
        hammerPence: saleSellerTerms.hammerPence,
        commissionPence: saleSellerTerms.commissionPence,
        commissionVatTreatment: saleSellerTerms.commissionVatTreatment,
        commissionVatBps: saleSellerTerms.commissionVatBps,
        commissionVatPence: saleSellerTerms.commissionVatPence,
        sellerNetPence: saleSellerTerms.sellerNetPence,
      })
      .from(payoutLine)
      .leftJoin(saleSellerTerms, eq(saleSellerTerms.id, payoutLine.sellerTermsId))
      .where(eq(payoutLine.payoutId, row.id))
      .orderBy(asc(payoutLine.createdAt), asc(payoutLine.id));
    const sales: BidPayoutSaleFacts[] = [];
    let otherLines = 0;
    for (const line of lines) {
      const priced =
        line.kind === "sale" &&
        line.termsId !== null &&
        line.paymentId !== null &&
        line.lotId !== null &&
        line.commissionPence !== null &&
        line.commissionVatPence !== null &&
        line.sellerNetPence !== null &&
        line.commissionVatTreatment !== null &&
        VAT_TREATMENTS.has(line.commissionVatTreatment) &&
        Number(line.amountPence) === line.hammerPence &&
        // The commission is the signed agreement's, on this seller's own sale, and its VAT is the
        // rule's own figure for the stated rate: anything else is left for a person.
        line.basis === "agreement" &&
        line.agreementId !== null &&
        line.sellerLegalEntityId !== null &&
        String(line.sellerLegalEntityId).toLowerCase() ===
          String(row.legalEntityId).toLowerCase() &&
        commissionVatAgrees(line);
      if (!priced) {
        otherLines += 1;
        continue;
      }
      sales.push({
        lotId: String(line.lotId).toLowerCase(),
        paymentId: String(line.paymentId).toLowerCase(),
        hammerPence: Number(line.hammerPence),
        commissionPence: Number(line.commissionPence),
        commissionVatTreatment: line.commissionVatTreatment as "standard" | "not_registered",
        commissionVatPence: Number(line.commissionVatPence),
        sellerNetPence: Number(line.sellerNetPence),
      });
    }
    const paid =
      row.status === "paid" && row.processedAt !== null
        ? { paidOn: londonDay(row.processedAt), throughStripe: row.stripeTransferId !== null }
        : null;
    return ready({
      payoutId: row.id.toLowerCase(),
      seller: {
        id: row.legalEntityId.toLowerCase(),
        name: row.legalName?.trim() || row.displayName,
      },
      createdOn: londonDay(row.createdAt),
      grossPence: Number(row.grossPence),
      platformFeePence: Number(row.platformFeePence),
      stripeFeePence: Number(row.stripeFeePence),
      netPence: Number(row.netPence),
      sales,
      otherLines,
      paid,
    });
  }

  async shopArtistPayout(payoutId: string): Promise<FactsRead<ShopArtistPayoutFacts>> {
    const [row] = await this.db
      .select({
        id: shopPayoutLedger.id,
        orderLineId: shopPayoutLedger.orderLineId,
        thirdPartySaleId: shopPayoutLedger.thirdPartySaleId,
        originalSaleId: shopPayoutLedger.originalSaleId,
        ownerPartyId: shopPayoutLedger.ownerPartyId,
        payeeName: shopParty.displayName,
        grossPence: shopPayoutLedger.grossPence,
        deductionsPence: shopPayoutLedger.deductionsPence,
        netPence: shopPayoutLedger.netPence,
        payoutDueAt: shopPayoutLedger.payoutDueAt,
        status: shopPayoutLedger.status,
        source: shopPayoutLedger.source,
        payeeKind: shopPayoutLedger.payeeKind,
        paidAt: shopPayoutLedger.paidAt,
        paidBySubjectId: shopPayoutLedger.paidBySubjectId,
        createdAt: shopPayoutLedger.createdAt,
      })
      .from(shopPayoutLedger)
      .innerJoin(shopParty, eq(shopParty.id, shopPayoutLedger.ownerPartyId))
      .where(eq(shopPayoutLedger.id, payoutId));
    if (!row) return skip("payout_not_found");
    if (row.payeeKind === "lax") return skip("lax_own_stock");
    if (row.status !== "paid" || row.paidAt === null) return skip("payout_not_paid");
    if (row.netPence <= 0) return skip("payout_nothing_owed");
    const source = row.source as ShopPayoutSource;
    const sourceRowId =
      source === "order_line"
        ? row.orderLineId
        : source === "third_party_sale"
          ? row.thirdPartySaleId
          : row.originalSaleId;
    if (sourceRowId === null) return skip("payout_source_missing");
    return ready({
      payoutId: row.id.toLowerCase(),
      payee: { id: row.ownerPartyId.toLowerCase(), name: row.payeeName },
      source,
      sourceRowId: sourceRowId.toLowerCase(),
      grossPence: row.grossPence,
      deductionsPence: row.deductionsPence,
      netPence: row.netPence,
      owedOn: londonDay(row.createdAt),
      dueOn: londonDay(row.payoutDueAt),
      paidOn: londonDay(row.paidAt),
      throughStripe: row.paidBySubjectId === SHOP_CONNECT_TRANSFER_ACTOR,
    });
  }
}
