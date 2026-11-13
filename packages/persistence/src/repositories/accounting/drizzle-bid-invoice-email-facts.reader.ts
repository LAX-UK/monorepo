import type { Database } from "@auction/db";
import {
  bidIdentityDirectory,
  bidInvoice,
  domainEvent,
  legalEntityInvoiceDetails,
  lot,
  payment,
} from "@auction/db/schema";
import { and, desc, eq, sql } from "drizzle-orm";
import type {
  BidInvoiceEmailFacts,
  IBidInvoiceEmailFactsReader,
} from "../../interfaces/accounting.js";

/**
 * What the "Your invoice" email says, read from the invoice's own rows: the lot, the stored
 * total and due date, whether it is paid (and when), and who it goes to. Read-only.
 */
export class DrizzleBidInvoiceEmailFactsReader implements IBidInvoiceEmailFactsReader {
  constructor(private readonly db: Database) {}

  async forInvoice(invoiceId: string): Promise<BidInvoiceEmailFacts | null> {
    const [invoice] = await this.db
      .select({
        id: bidInvoice.id,
        lotId: bidInvoice.lotId,
        totalPence: bidInvoice.totalPence,
        dueAt: bidInvoice.dueAt,
        voidedAt: bidInvoice.voidedAt,
        buyerLegalEntityId: bidInvoice.buyerLegalEntityId,
        lotTitle: lot.title,
        billingEmail: legalEntityInvoiceDetails.billingEmail,
      })
      .from(bidInvoice)
      .innerJoin(lot, eq(lot.id, bidInvoice.lotId))
      .leftJoin(
        legalEntityInvoiceDetails,
        eq(legalEntityInvoiceDetails.legalEntityId, bidInvoice.buyerLegalEntityId),
      )
      .where(eq(bidInvoice.id, invoiceId));
    if (!invoice) return null;

    // The invoice's latest payment row names the member who pays it.
    const [latest] = await this.db
      .select({
        id: payment.id,
        status: payment.status,
        userId: bidIdentityDirectory.subjectId,
        email: bidIdentityDirectory.email,
        name: bidIdentityDirectory.name,
      })
      .from(payment)
      // The identity directory, not the identity tables: the Bid copy of who the member is.
      .innerJoin(bidIdentityDirectory, eq(bidIdentityDirectory.subjectId, payment.buyerId))
      .where(eq(payment.invoiceId, invoice.id))
      .orderBy(desc(payment.createdAt), desc(payment.id))
      .limit(1);

    let paidAt: Date | null = null;
    if (latest && (latest.status === "captured" || latest.status === "refunded")) {
      const [captured] = await this.db
        .select({ at: sql<string>`${domainEvent.payload} ->> 'capturedAt'` })
        .from(domainEvent)
        .where(
          and(
            eq(domainEvent.eventType, "payment.captured"),
            eq(domainEvent.aggregateId, latest.id),
          ),
        )
        .orderBy(desc(domainEvent.id))
        .limit(1);
      const at = captured?.at ? new Date(captured.at) : null;
      paidAt = at && !Number.isNaN(at.getTime()) ? at : null;
    }

    return {
      invoiceId: invoice.id,
      lotId: invoice.lotId,
      lotTitle: invoice.lotTitle,
      totalPence: invoice.totalPence,
      paidAt,
      dueAt: invoice.dueAt,
      cancelled: invoice.voidedAt !== null,
      payer: latest ? { userId: latest.userId, email: latest.email, name: latest.name } : null,
      billingEmail: invoice.billingEmail ?? null,
      buyerLegalEntityId: invoice.buyerLegalEntityId,
    };
  }
}
