import { payment, paymentGroup } from "@auction/db/schema";
import type { SubjectExportRecord } from "@auction/identity-contracts";
import { and, asc, eq, inArray } from "drizzle-orm";
import { type ExportSource, SourcedExportCategory } from "../sourced-export-category.js";
import type { SubjectExportDeps } from "../subject-export-deps.js";
import { isoRequired, money } from "../subject-export-values.js";
import { afterKey, countWhere } from "./keyset.js";

const PAYMENT_STATUS: Record<string, string> = {
  authorized: "authorised",
  captured: "succeeded",
  refunded: "refunded",
};

const PAID_STATUSES = ["authorized", "captured", "refunded"] as const;

type PaymentRow = {
  id: string;
  amount: string;
  status: string;
  createdAt: Date;
  rail: string | null;
};

/**
 * Bid never sees card numbers, and does not keep the card brand or last four digits of a payment,
 * so the method is the payment rail where one was recorded. Stripe ids and the platform fee (the
 * seller's side) are not selected.
 */
function method(rail: string | null) {
  return rail ? { type: rail, brand: null, last4: null } : null;
}

export function mapPayment(row: PaymentRow) {
  return {
    id: row.id,
    origin: "observed" as const,
    invoiceId: row.id,
    amount: money(row.amount),
    kind: "payment",
    method: method(row.rail),
    status: PAYMENT_STATUS[row.status] ?? row.status,
    occurredAt: isoRequired(row.createdAt),
  };
}

export function mapRefund(row: PaymentRow) {
  return { ...mapPayment(row), id: `${row.id}:refund`, kind: "refund", status: "succeeded" };
}

export class PaymentsCategory extends SourcedExportCategory {
  readonly id = "payments";
  protected readonly sources: readonly ExportSource[];

  constructor({ db }: SubjectExportDeps) {
    super();
    const columns = {
      id: payment.id,
      amount: payment.amount,
      status: payment.status,
      createdAt: payment.createdAt,
      rail: paymentGroup.checkoutRail,
    };
    const page =
      (
        statuses: readonly ("authorized" | "captured" | "refunded")[],
        map: (row: PaymentRow) => SubjectExportRecord,
      ) =>
      async (s: string, after: string | null, limit: number) => {
        const rows = await db
          .select(columns)
          .from(payment)
          .leftJoin(paymentGroup, eq(paymentGroup.id, payment.paymentGroupId))
          .where(
            and(
              eq(payment.buyerId, s),
              inArray(payment.status, [...statuses]),
              afterKey(payment.id, after),
            ),
          )
          .orderBy(asc(payment.id))
          .limit(limit);
        return rows.map((row) => ({ key: row.id, record: map(row) }));
      };
    const countStatuses =
      (statuses: readonly ("authorized" | "captured" | "refunded")[]) => (s: string) =>
        countWhere(
          db,
          payment,
          and(eq(payment.buyerId, s), inArray(payment.status, [...statuses])),
        );

    this.sources = [
      { count: countStatuses(PAID_STATUSES), page: page(PAID_STATUSES, mapPayment) },
      { count: countStatuses(["refunded"]), page: page(["refunded"], mapRefund) },
    ];
  }
}
