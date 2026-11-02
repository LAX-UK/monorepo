import { lot, payment, paymentExternalRef } from "@auction/db/schema";
import { and, asc, eq } from "drizzle-orm";
import { type ExportSource, SourcedExportCategory } from "../sourced-export-category.js";
import type { SubjectExportDeps } from "../subject-export-deps.js";
import { isoRequired, money } from "../subject-export-values.js";
import { afterKey, countWhere } from "./keyset.js";

/**
 * A held-for-review invoice is shown as open like any other unpaid one, so the copy never hints
 * at a compliance review.
 */
const INVOICE_STATUS: Record<string, string> = {
  pending: "open",
  authorized: "open",
  requires_manual_review: "open",
  captured: "paid",
  refunded: "refunded",
  cancelled: "void",
};

export function mapInvoice(row: {
  id: string;
  number: string | null;
  lotTitle: string;
  amount: string;
  status: string;
  createdAt: Date;
}) {
  const total = money(row.amount);
  return {
    id: row.id,
    origin: "observed" as const,
    number: row.number,
    issuedAt: isoRequired(row.createdAt),
    // Bid does not store a due date for an invoice.
    dueAt: null,
    lines: [{ description: row.lotTitle, amount: total }],
    total,
    status: INVOICE_STATUS[row.status] ?? "open",
    // The invoice PDF is the one Xero hosts; Bid holds no copy in its own storage to sign.
    file: null,
  };
}

export class InvoicesCategory extends SourcedExportCategory {
  readonly id = "invoices";
  protected readonly sources: readonly ExportSource[];

  constructor({ db }: SubjectExportDeps) {
    super();
    this.sources = [
      {
        count: (s) => countWhere(db, payment, eq(payment.buyerId, s)),
        page: async (s, after, limit) => {
          const rows = await db
            .select({
              id: payment.id,
              number: paymentExternalRef.xeroInvoiceNumber,
              lotTitle: lot.title,
              amount: payment.amount,
              status: payment.status,
              createdAt: payment.createdAt,
            })
            .from(payment)
            .innerJoin(lot, eq(lot.id, payment.lotId))
            .leftJoin(paymentExternalRef, eq(paymentExternalRef.paymentId, payment.id))
            .where(and(eq(payment.buyerId, s), afterKey(payment.id, after)))
            .orderBy(asc(payment.id))
            .limit(limit);
          return rows.map((row) => ({ key: row.id, record: mapInvoice(row) }));
        },
      },
    ];
  }
}
