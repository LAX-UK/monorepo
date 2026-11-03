import { shopOrder, shopRefund } from "@auction/db/schema";
import {
  type ExportSource,
  SourcedExportCategory,
} from "@auction/identity-contracts/subject-export-readers";
import { and, asc, count, eq, isNotNull } from "drizzle-orm";
import type { SubjectExportDeps } from "../subject-export-deps.js";
import { iso, isoRequired, pence } from "../subject-export-values.js";
import { afterKey, countWhere } from "./keyset.js";

export function mapOrderPayment(row: {
  id: string;
  reference: string;
  paidAt: Date;
  totalPence: number;
}) {
  return {
    id: `payment:${row.id}`,
    origin: "observed" as const,
    orderId: row.id,
    orderReference: row.reference,
    amount: pence(row.totalPence),
    kind: "payment",
    // Shop does not keep the card brand or last four digits; the card details stay with the processor.
    method: null,
    status: "succeeded",
    occurredAt: isoRequired(row.paidAt),
  };
}

export function mapRefund(row: {
  id: string;
  orderId: string;
  reference: string;
  amountPence: number;
  status: string;
  submittedAt: Date | null;
  createdAt: Date;
}) {
  return {
    id: `refund:${row.id}`,
    origin: "observed" as const,
    orderId: row.orderId,
    orderReference: row.reference,
    amount: pence(row.amountPence),
    kind: "refund",
    method: null,
    status: row.status,
    occurredAt: iso(row.submittedAt) ?? isoRequired(row.createdAt),
  };
}

/**
 * Payments are the paid orders; refunds are the refunds on them. Stripe identifiers, the
 * processor's error text, the retry count and the staff member who requested a refund are not
 * selected, and disputes are the processor's matter and are not read.
 */
export class PaymentsCategory extends SourcedExportCategory {
  readonly id = "payments";
  protected readonly sources: readonly ExportSource[];

  constructor({ db }: SubjectExportDeps) {
    super();
    const paid = (s: string) =>
      and(eq(shopOrder.identitySubjectId, s), isNotNull(shopOrder.paidAt));

    this.sources = [
      {
        count: (s) => countWhere(db, shopOrder, paid(s)),
        page: async (s, after, limit) => {
          const rows = await db
            .select({
              id: shopOrder.id,
              reference: shopOrder.reference,
              paidAt: shopOrder.paidAt,
              totalPence: shopOrder.totalPence,
            })
            .from(shopOrder)
            .where(and(paid(s), afterKey(shopOrder.id, after)))
            .orderBy(asc(shopOrder.id))
            .limit(limit);
          return rows.flatMap((row) =>
            row.paidAt
              ? [{ key: row.id, record: mapOrderPayment({ ...row, paidAt: row.paidAt }) }]
              : [],
          );
        },
      },
      {
        count: async (s) => {
          const [row] = await db
            .select({ n: count() })
            .from(shopRefund)
            .innerJoin(shopOrder, eq(shopOrder.id, shopRefund.orderId))
            .where(eq(shopOrder.identitySubjectId, s));
          return Number(row?.n ?? 0);
        },
        page: async (s, after, limit) => {
          const rows = await db
            .select({
              id: shopRefund.id,
              orderId: shopRefund.orderId,
              reference: shopOrder.reference,
              amountPence: shopRefund.amountPence,
              status: shopRefund.status,
              submittedAt: shopRefund.submittedAt,
              createdAt: shopRefund.createdAt,
            })
            .from(shopRefund)
            .innerJoin(shopOrder, eq(shopOrder.id, shopRefund.orderId))
            .where(and(eq(shopOrder.identitySubjectId, s), afterKey(shopRefund.id, after)))
            .orderBy(asc(shopRefund.id))
            .limit(limit);
          return rows.map((row) => ({ key: row.id, record: mapRefund(row) }));
        },
      },
    ];
  }
}
