import type { Database } from "@auction/db";
import {
  bidIdentityDirectory,
  bidInvoice,
  domainEvent,
  legalEntity,
  legalEntityInvoiceDetails,
  legalEntityMember,
  lot,
  payment,
} from "@auction/db/schema";
import { buyerPaymentAuthority } from "@auction/domain";
import { and, desc, eq, isNotNull, isNull, sql } from "drizzle-orm";
import type {
  BidInvoiceEmailFacts,
  IBidInvoiceEmailFactsReader,
} from "../../interfaces/accounting.js";

/**
 * What the "Your invoice" email says, read from the invoice's own rows: the lot, the stored
 * total and due date, whether it is paid (and when), and who it goes to. Read-only.
 *
 * The payer is only named while they may still pay this purchase, by the same rule as the
 * download routes (`buyerPaymentAuthority`): for an organisation, an active member whose role
 * moves its money. A member who has since left, or lost that role, is not emailed the invoice.
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
        buyerAccountKind: legalEntity.kind,
        lotWinnerId: lot.winnerId,
        lotTitle: lot.title,
        billingEmail: legalEntityInvoiceDetails.billingEmail,
      })
      .from(bidInvoice)
      .innerJoin(lot, eq(lot.id, bidInvoice.lotId))
      .innerJoin(legalEntity, eq(legalEntity.id, bidInvoice.buyerLegalEntityId))
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

    const payer = latest ? await this.currentPayer(invoice, latest) : null;

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
      payer,
      billingEmail: invoice.billingEmail ?? null,
      buyerLegalEntityId: invoice.buyerLegalEntityId,
    };
  }

  /** The latest payment's member, while they still pay for the buyer account; otherwise null. */
  private async currentPayer(
    invoice: {
      buyerLegalEntityId: string;
      buyerAccountKind: "individual" | "organisation";
      lotWinnerId: string | null;
    },
    latest: { userId: string; email: string; name: string },
  ): Promise<BidInvoiceEmailFacts["payer"]> {
    const [membership] =
      invoice.buyerAccountKind === "organisation"
        ? await this.db
            .select({ role: legalEntityMember.role })
            .from(legalEntityMember)
            .where(
              and(
                eq(legalEntityMember.legalEntityId, invoice.buyerLegalEntityId),
                eq(legalEntityMember.userId, latest.userId),
                isNull(legalEntityMember.removedAt),
                isNotNull(legalEntityMember.acceptedAt),
              ),
            )
            .limit(1)
        : [];
    const decision = buyerPaymentAuthority({
      payerUserId: latest.userId,
      lot: { winnerId: invoice.lotWinnerId, buyerAccountKind: invoice.buyerAccountKind },
      membership: membership ? { role: membership.role } : null,
    });
    return decision.allowed
      ? { userId: latest.userId, email: latest.email, name: latest.name }
      : null;
  }
}
