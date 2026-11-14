import { describe, expect, it } from "vitest";
import {
  BOOKS_PAYMENT_HOLD_BACK_LIMIT_MS,
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
const NOW = new Date("2026-11-14T02:15:00Z");
const DAY = 24 * 60 * 60_000;
const lax = (over: Partial<LaxPaymentsInBooks> = {}): LaxPaymentsInBooks => ({
  ...NO_LAX_PAYMENTS,
  ...over,
});

describe("deciding what a Books status read means", () => {
  it("records the first read as a change from nothing", () => {
    const d = decideBooksStatus({
      now: NOW,
      previous: null,
      read: read(),
      laxPayments: NO_LAX_PAYMENTS,
    });
    expect(d.changes).toEqual([{ kind: "state_changed", from: null, to: "open" }]);
    expect(d.financeTasks).toEqual([]);
    expect(d.snapshot).toEqual({
      state: "open",
      balancePence: 10_000,
      paymentIds: [],
      heldSince: {},
    });
  });

  it("records nothing when nothing changed", () => {
    const previous = {
      state: "open" as const,
      balancePence: 10_000,
      paymentIds: [],
      heldSince: {},
    };
    expect(
      decideBooksStatus({ now: NOW, previous, read: read(), laxPayments: NO_LAX_PAYMENTS }).changes,
    ).toEqual([]);
  });

  it("records a void", () => {
    const previous = {
      state: "open" as const,
      balancePence: 10_000,
      paymentIds: [],
      heldSince: {},
    };
    const d = decideBooksStatus({
      now: NOW,
      previous,
      read: read({ state: "void" }),
      laxPayments: NO_LAX_PAYMENTS,
    });
    expect(d.changes).toEqual([{ kind: "state_changed", from: "open", to: "void" }]);
  });

  it("records a document deleted in Books as missing", () => {
    const previous = {
      state: "open" as const,
      balancePence: 10_000,
      paymentIds: [],
      heldSince: {},
    };
    const d = decideBooksStatus({
      now: NOW,
      previous,
      read: { status: "not_found" },
      laxPayments: NO_LAX_PAYMENTS,
    });
    expect(d.changes).toEqual([{ kind: "state_changed", from: "open", to: "missing" }]);
    expect(d.snapshot.state).toBe("missing");
  });

  it("a payment LAX sent is never a finance task", () => {
    const d = decideBooksStatus({
      now: NOW,
      previous: null,
      read: read({ state: "paid", balancePence: 0, payments: [stripe] }),
      laxPayments: lax({ providerIds: new Set(["800"]) }),
    });
    expect(d.financeTasks).toEqual([]);
    expect(d.changes).toEqual([{ kind: "state_changed", from: null, to: "paid" }]);
  });

  it("a payment recorded in Books by hand is one finance task, the first time only", () => {
    const first = decideBooksStatus({
      now: NOW,
      previous: { state: "open", balancePence: 10_000, paymentIds: [], heldSince: {} },
      read: read({ state: "partially_paid", balancePence: 6_000, payments: [cheque] }),
      laxPayments: NO_LAX_PAYMENTS,
    });
    expect(first.financeTasks).toEqual([cheque]);
    expect(first.changes).toContainEqual({ kind: "payment_recorded_in_books", payment: cheque });
    expect(first.snapshot.paymentIds).toEqual(["900"]);

    const again = decideBooksStatus({
      now: NOW,
      previous: first.snapshot,
      read: read({ state: "partially_paid", balancePence: 6_000, payments: [cheque] }),
      laxPayments: NO_LAX_PAYMENTS,
    });
    expect(again.financeTasks).toEqual([]);
    expect(again.changes).toEqual([]);
  });

  it("the decision can only ever say what changed and which tasks to open, never 'mark paid'", () => {
    const d = decideBooksStatus({
      now: NOW,
      previous: null,
      read: read({ state: "paid", balancePence: 0, payments: [cheque, stripe] }),
      laxPayments: lax({ providerIds: new Set(["800"]) }),
    });
    expect(Object.keys(d).sort()).toEqual([
      "changes",
      "financeTasks",
      "heldBack",
      "releasedFromHold",
      "snapshot",
    ]);
    expect(d.financeTasks).toEqual([cheque]);
  });

  it("a payment LAX sent but holds no Books id for is LAX's own by its reference", () => {
    const d = decideBooksStatus({
      now: NOW,
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
      now: NOW,
      previous: null,
      read: read({ state: "paid", balancePence: 0, payments: [stripe] }),
      laxPayments: lax({ providerIds: new Set(["801"]) }),
    });
    expect(d.financeTasks).toEqual([stripe]);
  });

  it("while a LAX payment on the invoice is unsettled, an unknown payment is held back, not reported", () => {
    const d = decideBooksStatus({
      now: NOW,
      previous: { state: "open", balancePence: 10_000, paymentIds: [], heldSince: {} },
      read: read({ state: "partially_paid", balancePence: 6_000, payments: [cheque] }),
      laxPayments: lax({ unresolved: true }),
    });
    expect(d.financeTasks).toEqual([]);
    expect(d.heldBack).toEqual([cheque]);
    expect(d.changes).toEqual([{ kind: "state_changed", from: "open", to: "partially_paid" }]);
    // Not remembered: once LAX's payment is settled, the next read looks at it again.
    expect(d.snapshot.paymentIds).toEqual([]);

    const settled = decideBooksStatus({
      now: NOW,
      previous: d.snapshot,
      read: read({ state: "partially_paid", balancePence: 6_000, payments: [cheque] }),
      laxPayments: NO_LAX_PAYMENTS,
    });
    expect(settled.financeTasks).toEqual([cheque]);
    expect(settled.heldBack).toEqual([]);
  });

  describe("a payment held back while a LAX payment stays unresolved", () => {
    const stuck = lax({ unresolved: true });
    const reading = read({ state: "partially_paid", balancePence: 6_000, payments: [cheque] });
    const at = (ms: number) => new Date(NOW.getTime() + ms);

    it("is held, with no task, for up to 3 days from when it was first held", () => {
      const first = decideBooksStatus({
        now: NOW,
        previous: null,
        read: reading,
        laxPayments: stuck,
      });
      expect(first.heldBack).toEqual([cheque]);
      expect(first.snapshot.heldSince).toEqual({ "900": NOW.getTime() });
      // Each later read keeps the first time, so the hold is counted from the first.
      let previous = first.snapshot;
      for (const later of [1 * DAY, 2 * DAY, BOOKS_PAYMENT_HOLD_BACK_LIMIT_MS]) {
        const d = decideBooksStatus({
          now: at(later),
          previous,
          read: reading,
          laxPayments: stuck,
        });
        expect(d.financeTasks).toEqual([]);
        expect(d.releasedFromHold).toEqual([]);
        expect(d.heldBack).toEqual([cheque]);
        expect(d.snapshot.heldSince).toEqual({ "900": NOW.getTime() });
        expect(d.snapshot.paymentIds).toEqual([]);
        previous = d.snapshot;
      }
    });

    it("after more than 3 days becomes a task anyway, marked as possibly LAX's own, once", () => {
      const first = decideBooksStatus({
        now: NOW,
        previous: null,
        read: reading,
        laxPayments: stuck,
      });
      const late = decideBooksStatus({
        now: at(BOOKS_PAYMENT_HOLD_BACK_LIMIT_MS + 60_000),
        previous: first.snapshot,
        read: reading,
        laxPayments: stuck,
      });
      expect(late.financeTasks).toEqual([cheque]);
      expect(late.releasedFromHold).toEqual([{ payment: cheque, heldSince: NOW.getTime() }]);
      expect(late.heldBack).toEqual([]);
      expect(late.changes).toContainEqual({ kind: "payment_recorded_in_books", payment: cheque });
      expect(late.snapshot.paymentIds).toEqual(["900"]);
      expect(late.snapshot.heldSince).toEqual({});

      const again = decideBooksStatus({
        now: at(5 * DAY),
        previous: late.snapshot,
        read: reading,
        laxPayments: stuck,
      });
      expect(again.financeTasks).toEqual([]);
      expect(again.releasedFromHold).toEqual([]);
      expect(again.heldBack).toEqual([]);
    });

    it("once the LAX payment settles within the hold, is reported the normal way, unmarked", () => {
      const first = decideBooksStatus({
        now: NOW,
        previous: null,
        read: reading,
        laxPayments: stuck,
      });
      const settled = decideBooksStatus({
        now: at(2 * DAY),
        previous: first.snapshot,
        read: reading,
        laxPayments: NO_LAX_PAYMENTS,
      });
      expect(settled.financeTasks).toEqual([cheque]);
      expect(settled.releasedFromHold).toEqual([]);
      expect(settled.snapshot.heldSince).toEqual({});
    });

    it("a payment that turns out to be LAX's own is never released, however long it was held", () => {
      const first = decideBooksStatus({
        now: NOW,
        previous: null,
        read: reading,
        laxPayments: stuck,
      });
      const known = decideBooksStatus({
        now: at(10 * DAY),
        previous: first.snapshot,
        read: reading,
        laxPayments: lax({ unresolved: true, providerIds: new Set(["900"]) }),
      });
      expect(known.financeTasks).toEqual([]);
      expect(known.releasedFromHold).toEqual([]);
    });
  });

  it("checks invoices, credit notes and payments only", () => {
    expect(
      ["invoice", "credit_note", "payment", "contact", "bill"].map((k) =>
        isStatusCheckedKind(k as never),
      ),
    ).toEqual([true, true, true, false, false]);
    expect(booksPaymentTaskReference("9000000000001", "900", "LAX-BID-INV-1")).toBe(
      "books:9000000000001:900:LAX-BID-INV-1",
    );
  });
});
