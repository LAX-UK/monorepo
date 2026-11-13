import type { Database } from "@auction/db";
import { bidInvoiceLine, payment, saleSellerTerms } from "@auction/db/schema";
import type { SellerTermsSnapshot } from "@auction/domain";
import { and, asc, eq } from "drizzle-orm";
import type {
  ISaleSellerTermsStore,
  StoredInvoiceLine,
  StoredSellerTerms,
} from "../interfaces/sale-seller-terms.store.js";
import { sellerTermsRow, sellerTermsSnapshotFromRow } from "./seller-terms-row.js";

type SellerTermsRow = typeof saleSellerTerms.$inferSelect;

const stored = (row: SellerTermsRow): StoredSellerTerms => ({
  id: row.id,
  snapshot: sellerTermsSnapshotFromRow(row),
});

/** Seller-terms snapshots as settlement reads and completes them. */
export class DrizzleSaleSellerTermsStore implements ISaleSellerTermsStore {
  constructor(private readonly db: Database) {}

  async invoiceLinesForPayment(paymentId: string): Promise<StoredInvoiceLine[] | null> {
    const rows = await this.db
      .select({ kind: bidInvoiceLine.kind, amountPence: bidInvoiceLine.amountPence })
      .from(payment)
      .innerJoin(bidInvoiceLine, eq(bidInvoiceLine.invoiceId, payment.invoiceId))
      .where(eq(payment.id, paymentId))
      .orderBy(asc(bidInvoiceLine.position));
    return rows.length > 0 ? rows : null;
  }

  async recordAtPayout(input: {
    paymentId: string;
    snapshot: SellerTermsSnapshot;
    legacyPlatformFeePence: number | null;
  }): Promise<StoredSellerTerms> {
    const [inserted] = await this.db
      .insert(saleSellerTerms)
      .values(
        sellerTermsRow(
          input.paymentId,
          input.snapshot,
          input.legacyPlatformFeePence,
          "recomputed_at_payout",
        ),
      )
      .onConflictDoNothing({ target: saleSellerTerms.paymentId })
      .returning();
    if (inserted) return stored(inserted);
    return stored(await this.byPayment(input.paymentId));
  }

  async repriceHeld(id: string, snapshot: SellerTermsSnapshot): Promise<StoredSellerTerms> {
    const row = sellerTermsRow("", snapshot, null, "recomputed_at_payout");
    // Only the figures and how they were made; what the row is for stays as it was raised.
    const [updated] = await this.db
      .update(saleSellerTerms)
      .set({
        basis: row.basis,
        heldReason: row.heldReason ?? null,
        agreementId: row.agreementId ?? null,
        commissionBps: row.commissionBps ?? null,
        commissionPence: row.commissionPence ?? null,
        commissionVatTreatment: row.commissionVatTreatment ?? null,
        commissionVatBps: row.commissionVatBps ?? null,
        commissionVatPence: row.commissionVatPence ?? null,
        otherCharges: row.otherCharges ?? [],
        sellerNetPence: row.sellerNetPence ?? null,
        ruleVersion: row.ruleVersion,
        source: row.source,
        computedAt: new Date(),
      })
      .where(and(eq(saleSellerTerms.id, id), eq(saleSellerTerms.basis, "held")))
      .returning();
    if (updated) return stored(updated);
    const [current] = await this.db
      .select()
      .from(saleSellerTerms)
      .where(eq(saleSellerTerms.id, id))
      .limit(1);
    if (!current) throw new Error(`sale_seller_terms row ${id} not found`);
    return stored(current);
  }

  private async byPayment(paymentId: string): Promise<SellerTermsRow> {
    const [row] = await this.db
      .select()
      .from(saleSellerTerms)
      .where(eq(saleSellerTerms.paymentId, paymentId))
      .limit(1);
    if (!row) throw new Error(`sale_seller_terms row for payment ${paymentId} not found`);
    return row;
  }
}
