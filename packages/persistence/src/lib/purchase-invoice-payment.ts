import { payment } from "@auction/db/schema";
import { type SQL, sql } from "drizzle-orm";

/** Payment statuses of an invoice that is open or settled: the one row the purchase is about. */
export const OPEN_OR_SETTLED_PAYMENT_STATUSES = [
  "pending",
  "authorized",
  "captured",
  "requires_manual_review",
  "refunded",
] as const;

/**
 * The order that picks a purchase's invoice from the payment rows of a lot and account: the open
 * or settled payment (0251 keeps one), and without one, the latest row. The buyer's purchase page
 * and the staff Deliveries list both read the invoice this way, so they agree on a refund.
 */
export function invoicePaymentOrder(): SQL[] {
  return [
    sql`CASE WHEN ${payment.status} IN (${sql.join(
      OPEN_OR_SETTLED_PAYMENT_STATUSES.map((s) => sql`${s}`),
      sql`, `,
    )}) THEN 0 ELSE 1 END`,
    sql`${payment.createdAt} DESC`,
  ];
}
