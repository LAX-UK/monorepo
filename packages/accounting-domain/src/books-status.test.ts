import { describe, expect, it } from "vitest";
import {
  type BooksStatusReading,
  type LaxPaymentsInBooks,
  NO_LAX_PAYMENTS,
  booksPaymentTaskReference,
  decideBooksStatus,
  isStatusCheckedKind,
} from "./books-status.js";

const read = (reading: Partial<BooksStatusReading> = {}) => ({
  status: "read" as const,
  reading: { state: "open" as const, balancePence: 10_000, payments: [], ...reading },
});
const cheque = {
  providerPaymentId: "900",
  amountPence: 4_000,
  date: "2026-11-13",
  mode: "Cheque",
  reference: null,
};
const stripe = {
  providerPaymentId: "800",
  amountPence: 6_000,
  date: "2026-11-12",
  mode: "Stripe",
  reference: "LAX-BID-PAY-1",
};
const lax = (over: Partial<LaxPaymentsInBooks> = {}): LaxPaymentsInBooks => ({
  ...NO_LAX_PAYMENTS,
  ...over,
});

describe("deciding what a Books status read means", () => {
  it("records the first read as a change from nothing", () => {
    const d = decideBooksStatus({ previous: null, read: read(), laxPayments: NO_LAX_PAYMENTS });
    expect(d.changes).toEqual([{ kind: "state_changed", from: null, to: "open" }]);
    expect(d.financeTasks).toEqual([]);
    expect(d.snapshot).toEqual({ state: "open", balancePence: 10_000, paymentIds: [] });
  });

  it("records nothing when nothing changed", () => {
    const previous = { state: "open" as const, balancePence: 10_000, paymentIds: [] };
    expect(
      decideBooksStatus({ previous, read: read(), laxPayments: NO_LAX_PAYMENTS }).changes,
    ).toEqual([]);
  });

  it("records a void", () => {
    const previous = { state: "open" as const, balancePence: 10_000, paymentIds: [] };
    const d = decideBooksStatus({
      previous,
      read: read({ state: "void" }),
      laxPayments: NO_LAX_PAYMENTS,
    });
    expect(d.changes).toEqual([{ kind: "state_changed", from: "open", to: "void" }]);
  });

  it("records a document deleted in Books as missing", () => {
    const previous = { state: "open" as const, balancePence: 10_000, paymentIds: [] };
    const d = decideBooksStatus({
      previous,
      read: { status: "not_found" },
      laxPayments: NO_LAX_PAYMENTS,
    });
    expect(d.changes).toEqual([{ kind: "state_changed", from: "open", to: "missing" }]);
    expect(d.snapshot.state).toBe("missing");
  });

  it("a payment LAX sent is never a finance task", () => {
    const d = decideBooksStatus({
      previous: null,
      read: read({ state: "paid", balancePence: 0, payments: [stripe] }),
      laxPayments: lax({ providerIds: new Set(["800"]) }),
    });
    expect(d.financeTasks).toEqual([]);
    expect(d.changes).toEqual([{ kind: "state_changed", from: null, to: "paid" }]);
  });

  it("a payment recorded in Books by hand is one finance task, the first time only", () => {
    const first = decideBooksStatus({
      previous: { state: "open", balancePence: 10_000, paymentIds: [] },
      read: read({ state: "partially_paid", balancePence: 6_000, payments: [cheque] }),
      laxPayments: NO_LAX_PAYMENTS,
    });
    expect(first.financeTasks).toEqual([cheque]);
    expect(first.changes).toContainEqual({ kind: "payment_recorded_in_books", payment: cheque });
    expect(first.snapshot.paymentIds).toEqual(["900"]);

    const again = decideBooksStatus({
      previous: first.snapshot,
      read: read({ state: "partially_paid", balancePence: 6_000, payments: [cheque] }),
      laxPayments: NO_LAX_PAYMENTS,
    });
    expect(again.financeTasks).toEqual([]);
    expect(again.changes).toEqual([]);
  });

  it("the decision can only ever say what changed and which tasks to open, never 'mark paid'", () => {
    const d = decideBooksStatus({
      previous: null,
      read: read({ state: "paid", balancePence: 0, payments: [cheque, stripe] }),
      laxPayments: lax({ providerIds: new Set(["800"]) }),
    });
    expect(Object.keys(d).sort()).toEqual(["changes", "financeTasks", "heldBack", "snapshot"]);
    expect(d.financeTasks).toEqual([cheque]);
  });

  it("a payment LAX sent but holds no Books id for is LAX's own by its reference", () => {
    const d = decideBooksStatus({
      previous: null,
      read: read({ state: "paid", balancePence: 0, payments: [stripe] }),
      laxPayments: lax({
        referencesWithoutProviderId: new Set(["LAX-BID-PAY-1"]),
        unresolved: true,
      }),
    });
    expect(d.financeTasks).toEqual([]);
    expect(d.heldBack).toEqual([]);
    expect(d.snapshot.paymentIds).toEqual(["800"]);
  });

  it("a LAX reference on a payment is not enough once LAX holds that payment's Books id", () => {
    const d = decideBooksStatus({
      previous: null,
      read: read({ state: "paid", balancePence: 0, payments: [stripe] }),
      laxPayments: lax({ providerIds: new Set(["801"]) }),
    });
    expect(d.financeTasks).toEqual([stripe]);
  });

  it("while a LAX payment on the invoice is unsettled, an unknown payment is held back, not reported", () => {
    const d = decideBooksStatus({
      previous: { state: "open", balancePence: 10_000, paymentIds: [] },
      read: read({ state: "partially_paid", balancePence: 6_000, payments: [cheque] }),
      laxPayments: lax({ unresolved: true }),
    });
    expect(d.financeTasks).toEqual([]);
    expect(d.heldBack).toEqual([cheque]);
    expect(d.changes).toEqual([{ kind: "state_changed", from: "open", to: "partially_paid" }]);
    // Not remembered: once LAX's payment is settled, the next read looks at it again.
    expect(d.snapshot.paymentIds).toEqual([]);

    const settled = decideBooksStatus({
      previous: d.snapshot,
      read: read({ state: "partially_paid", balancePence: 6_000, payments: [cheque] }),
      laxPayments: NO_LAX_PAYMENTS,
    });
    expect(settled.financeTasks).toEqual([cheque]);
    expect(settled.heldBack).toEqual([]);
  });

  it("checks invoices, credit notes and payments only", () => {
    expect(
      ["invoice", "credit_note", "payment", "contact", "bill"].map((k) =>
        isStatusCheckedKind(k as never),
      ),
    ).toEqual([true, true, true, false, false]);
    expect(booksPaymentTaskReference("9000000000001", "900")).toBe("books:9000000000001:900");
  });
});
