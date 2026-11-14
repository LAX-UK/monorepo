import { describe, expect, it } from "vitest";
import {
  type BooksStatusReading,
  booksPaymentTaskReference,
  decideBooksStatus,
  isStatusCheckedKind,
} from "./books-status.js";

const read = (reading: Partial<BooksStatusReading> = {}) => ({
  status: "read" as const,
  reading: { state: "open" as const, balancePence: 10_000, payments: [], ...reading },
});
const cheque = { providerPaymentId: "900", amountPence: 4_000, date: "2026-11-13", mode: "Cheque" };
const stripe = { providerPaymentId: "800", amountPence: 6_000, date: "2026-11-12", mode: "Stripe" };

describe("deciding what a Books status read means", () => {
  it("records the first read as a change from nothing", () => {
    const d = decideBooksStatus({ previous: null, read: read(), laxPaymentIds: new Set() });
    expect(d.changes).toEqual([{ kind: "state_changed", from: null, to: "open" }]);
    expect(d.financeTasks).toEqual([]);
    expect(d.snapshot).toEqual({ state: "open", balancePence: 10_000, paymentIds: [] });
  });

  it("records nothing when nothing changed", () => {
    const previous = { state: "open" as const, balancePence: 10_000, paymentIds: [] };
    expect(decideBooksStatus({ previous, read: read(), laxPaymentIds: new Set() }).changes).toEqual(
      [],
    );
  });

  it("records a void", () => {
    const previous = { state: "open" as const, balancePence: 10_000, paymentIds: [] };
    const d = decideBooksStatus({
      previous,
      read: read({ state: "void" }),
      laxPaymentIds: new Set(),
    });
    expect(d.changes).toEqual([{ kind: "state_changed", from: "open", to: "void" }]);
  });

  it("records a document deleted in Books as missing", () => {
    const previous = { state: "open" as const, balancePence: 10_000, paymentIds: [] };
    const d = decideBooksStatus({
      previous,
      read: { status: "not_found" },
      laxPaymentIds: new Set(),
    });
    expect(d.changes).toEqual([{ kind: "state_changed", from: "open", to: "missing" }]);
    expect(d.snapshot.state).toBe("missing");
  });

  it("a payment LAX sent is never a finance task", () => {
    const d = decideBooksStatus({
      previous: null,
      read: read({ state: "paid", balancePence: 0, payments: [stripe] }),
      laxPaymentIds: new Set(["800"]),
    });
    expect(d.financeTasks).toEqual([]);
    expect(d.changes).toEqual([{ kind: "state_changed", from: null, to: "paid" }]);
  });

  it("a payment recorded in Books by hand is one finance task, the first time only", () => {
    const first = decideBooksStatus({
      previous: { state: "open", balancePence: 10_000, paymentIds: [] },
      read: read({ state: "partially_paid", balancePence: 6_000, payments: [cheque] }),
      laxPaymentIds: new Set(),
    });
    expect(first.financeTasks).toEqual([cheque]);
    expect(first.changes).toContainEqual({ kind: "payment_recorded_in_books", payment: cheque });
    expect(first.snapshot.paymentIds).toEqual(["900"]);

    const again = decideBooksStatus({
      previous: first.snapshot,
      read: read({ state: "partially_paid", balancePence: 6_000, payments: [cheque] }),
      laxPaymentIds: new Set(),
    });
    expect(again.financeTasks).toEqual([]);
    expect(again.changes).toEqual([]);
  });

  it("the decision can only ever say what changed and which tasks to open, never 'mark paid'", () => {
    const d = decideBooksStatus({
      previous: null,
      read: read({ state: "paid", balancePence: 0, payments: [cheque, stripe] }),
      laxPaymentIds: new Set(["800"]),
    });
    expect(Object.keys(d).sort()).toEqual(["changes", "financeTasks", "snapshot"]);
    expect(d.financeTasks).toEqual([cheque]);
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
