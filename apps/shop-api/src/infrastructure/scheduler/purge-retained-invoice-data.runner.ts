import type { Database } from "@auction/db";
import { shopOrder } from "@auction/db/schema";
import {
  type FinancialYearEnd,
  GUEST_RECORD_RETENTION_YEARS,
  guestInvoiceRetentionEndsAt,
} from "@auction/shop-domain";
import { and, inArray, isNotNull, isNull, lt } from "drizzle-orm";

const BATCH = 200;

/**
 * Clears the name and address kept on an erased guest's orders once the accounting retention has
 * passed. The domain decides when that is; the country, amounts, VAT and invoice number stay.
 */
export function createPurgeRetainedInvoiceDataRunner(
  db: Database,
  financialYearEnd: FinancialYearEnd,
): (now: Date) => Promise<{ purged: number }> {
  return async (now) => {
    // Nothing can be due before six whole years have passed, so only those orders are read.
    const earliest = new Date(now);
    earliest.setUTCFullYear(earliest.getUTCFullYear() - GUEST_RECORD_RETENTION_YEARS);
    const candidates = await db
      .select({ id: shopOrder.id, paidAt: shopOrder.paidAt, createdAt: shopOrder.createdAt })
      .from(shopOrder)
      .where(
        and(
          isNotNull(shopOrder.personalDataErasedAt),
          isNull(shopOrder.invoiceDataPurgedAt),
          lt(shopOrder.createdAt, earliest),
        ),
      )
      .limit(BATCH);
    const due = candidates
      .filter(
        (order) =>
          guestInvoiceRetentionEndsAt(order.paidAt ?? order.createdAt, financialYearEnd) < now,
      )
      .map((order) => order.id);
    if (due.length === 0) return { purged: 0 };
    await db
      .update(shopOrder)
      .set({
        deliveryRecipientName: null,
        deliveryLine1: null,
        deliveryLine2: null,
        deliveryCity: null,
        deliveryPostcode: null,
        invoiceDataPurgedAt: now,
        updatedAt: now,
      })
      .where(inArray(shopOrder.id, due));
    return { purged: due.length };
  };
}
