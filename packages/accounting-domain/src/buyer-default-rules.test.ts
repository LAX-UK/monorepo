import { describe, expect, it } from "vitest";
import {
  type DirectBankRefund,
  type FundsSource,
  approveDirectBankRefund,
  cancellationOf,
  checkVoid,
  lockRefundDestination,
  planReinvoiceAfterCreditNote,
  recordDirectBankRefundInBooks,
  requestDirectBankRefund,
} from "./buyer-default-rules.js";

const SENDER = { sortCode: "20-00-00", accountNumber: "5566 7788" };
const OTHER = { sortCode: "40-11-22", accountNumber: "11112222" };

describe("rule 1: void refused once sent", () => {
  it("refuses to void an invoice the buyer was sent, even one raised in error", () => {
    const sent = checkVoid({ sentToBuyer: true, raisedInError: true });
    expect(sent.ok).toBe(false);
    if (!sent.ok) expect(sent.refusal.code).toBe("invoice_sent");
    expect(cancellationOf({ sentToBuyer: true, raisedInError: false })).toBe("credit_note");
  });

  it("refuses to void an unsent invoice that was not raised in error", () => {
    const r = checkVoid({ sentToBuyer: false, raisedInError: false });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.refusal.code).toBe("not_raised_in_error");
  });

  it("voids only an invoice raised in error and never sent", () => {
    expect(checkVoid({ sentToBuyer: false, raisedInError: true })).toEqual({
      ok: true,
      value: "void",
    });
    expect(cancellationOf({ sentToBuyer: false, raisedInError: true })).toBe("void");
  });
});

describe("rule 2: re-invoice after a credit note", () => {
  const credited = {
    invoiceId: "inv-1",
    lotId: "lot-1",
    buyerLegalEntityId: "le-buyer",
    totalPence: 125_000,
    creditNoteReference: "LAX-BID-CN-dft-inv-1",
  };

  it("keeps the credit note and raises a new invoice for the same lot, applying the payment", () => {
    const r = planReinvoiceAfterCreditNote(credited, {
      paymentId: "pay-9",
      payerLegalEntityId: "le-buyer",
      amountPence: 125_000,
    });
    expect(r).toEqual({
      ok: true,
      value: {
        creditNoteStays: "LAX-BID-CN-dft-inv-1",
        newInvoice: {
          lotId: "lot-1",
          buyerLegalEntityId: "le-buyer",
          totalPence: 125_000,
          followsInvoiceId: "inv-1",
          idempotencyKey: "reinvoice:inv-1:pay-9",
        },
        allocation: { paymentId: "pay-9", amountPence: 125_000 },
      },
    });
  });

  it("gives the same key for the same payment, so a retry raises no second invoice", () => {
    const pay = { paymentId: "pay-9", payerLegalEntityId: "le-buyer", amountPence: 1 };
    const a = planReinvoiceAfterCreditNote(credited, pay);
    const b = planReinvoiceAfterCreditNote(credited, pay);
    expect(
      a.ok && b.ok && a.value.newInvoice.idempotencyKey === b.value.newInvoice.idempotencyKey,
    ).toBe(true);
  });

  it.each([
    [{ ...credited, creditNoteReference: null }, 100, "le-buyer", "invoice_not_credited"],
    [credited, 100, "le-someone-else", "payer_mismatch"],
    [credited, 125_001, "le-buyer", "overpaid"],
    [credited, 10.5, "le-buyer", "bad_amount"],
    [credited, 0, "le-buyer", "bad_amount"],
  ] as const)("refuses %#", (invoice, amountPence, payer, code) => {
    const r = planReinvoiceAfterCreditNote(invoice, {
      paymentId: "pay-9",
      payerLegalEntityId: payer,
      amountPence,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.refusal.code).toBe(code);
  });
});

describe("rule 3: refund destination locked to the source account", () => {
  it("refunds a card payment through Stripe and refuses a typed-in account", () => {
    const card: FundsSource = { rail: "card", chargeId: "ch_1" };
    expect(lockRefundDestination(card)).toEqual({
      ok: true,
      value: { via: "stripe", chargeId: "ch_1", expectedAccount: null },
    });
    const typed = lockRefundDestination(card, SENDER);
    expect(!typed.ok && typed.refusal.code).toBe("destination_not_source");
  });

  it("refunds a Stripe bank transfer through Stripe to the reported sender only", () => {
    const source: FundsSource = { rail: "stripe_bank_transfer", chargeId: "ch_2", sender: SENDER };
    expect(lockRefundDestination(source)).toEqual({
      ok: true,
      value: {
        via: "stripe",
        chargeId: "ch_2",
        expectedAccount: { sortCode: "200000", accountNumber: "55667788" },
      },
    });
    expect(
      lockRefundDestination(source, { sortCode: "200000", accountNumber: "55667788" }).ok,
    ).toBe(true);
    const other = lockRefundDestination(source, OTHER);
    expect(!other.ok && other.refusal.code).toBe("destination_not_source");
  });

  it("refuses a Stripe bank transfer whose sending account Stripe did not report", () => {
    const r = lockRefundDestination({
      rail: "stripe_bank_transfer",
      chargeId: "ch_3",
      sender: null,
    });
    expect(!r.ok && r.refusal.code).toBe("source_account_unknown");
  });

  it("locks a direct bank refund to the sending account", () => {
    const source: FundsSource = { rail: "direct_bank", sender: SENDER };
    expect(lockRefundDestination(source)).toEqual({
      ok: true,
      value: { via: "direct_bank", account: { sortCode: "200000", accountNumber: "55667788" } },
    });
    const other = lockRefundDestination(source, OTHER);
    expect(!other.ok && other.refusal.code).toBe("destination_not_source");
    const bad = lockRefundDestination(source, { sortCode: "12", accountNumber: "x" });
    expect(!bad.ok && bad.refusal.code).toBe("bad_account");
  });
});

describe("rule 3: direct bank refund needs two different staff", () => {
  const base = {
    idempotencyKey: "dbr:LAX-BID-CN-1:1",
    creditNoteReference: "LAX-BID-CN-1",
    refundablePence: 50_000,
    amountPence: 50_000,
    source: { rail: "direct_bank", sender: SENDER } as FundsSource,
    reason: "Buyer paid after the sale was cancelled",
    requestedBy: "staff-alice",
    at: "2026-11-19T10:00:00.000Z",
  };

  function requested(): DirectBankRefund {
    const r = requestDirectBankRefund(base);
    if (!r.ok) throw new Error(r.refusal.message);
    return r.value;
  }

  it("records the request with its locked account and an audit entry", () => {
    const r = requested();
    expect(r.status).toBe("requested");
    expect(r.account).toEqual({ sortCode: "200000", accountNumber: "55667788" });
    expect(r.audit).toEqual([
      { action: "requested", actorId: "staff-alice", at: "2026-11-19T10:00:00.000Z" },
    ]);
  });

  it.each([
    [{ amountPence: 50_001 }, "exceeds_refundable"],
    [{ amountPence: 99.5 }, "bad_amount"],
    [{ amountPence: 0 }, "bad_amount"],
    [{ reason: "short" }, "bad_reason"],
    [{ requestedAccount: OTHER }, "destination_not_source"],
    [
      { source: { rail: "stripe_bank_transfer", chargeId: "ch", sender: SENDER } },
      "not_direct_bank",
    ],
  ] as const)("refuses a bad request %#", (change, code) => {
    const r = requestDirectBankRefund({ ...base, ...(change as Partial<typeof base>) });
    expect(!r.ok && r.refusal.code).toBe(code);
  });

  it("is approved by a second, different staff member", () => {
    const approved = approveDirectBankRefund(requested(), "staff-bob", "2026-11-19T11:00:00.000Z");
    expect(approved.ok).toBe(true);
    if (!approved.ok) return;
    expect(approved.value).toMatchObject({ status: "approved", approvedBy: "staff-bob" });
    expect(approved.value.audit.map((e) => [e.action, e.actorId])).toEqual([
      ["requested", "staff-alice"],
      ["approved", "staff-bob"],
    ]);
  });

  it("refuses approval by the same person who asked, however the id is padded", () => {
    for (const id of ["staff-alice", "  staff-alice "]) {
      const r = approveDirectBankRefund(requested(), id, "2026-11-19T11:00:00.000Z");
      expect(!r.ok && r.refusal.code).toBe("approver_is_requester");
    }
  });

  it("treats a repeated approval as the same one and refuses a third person", () => {
    const first = approveDirectBankRefund(requested(), "staff-bob", "t1");
    if (!first.ok) throw new Error("approval refused");
    expect(approveDirectBankRefund(first.value, "staff-bob", "t2")).toEqual(first);
    const third = approveDirectBankRefund(first.value, "staff-carol", "t2");
    expect(!third.ok && third.refusal.code).toBe("already_approved");
  });

  it("is recorded in the books against the credit note only once approved, and once", () => {
    const early = recordDirectBankRefundInBooks(requested(), {
      actorId: "staff-bob",
      paidOn: "2026-11-19",
      at: "t",
    });
    expect(!early.ok && early.refusal.code).toBe("not_approved");

    const approved = approveDirectBankRefund(requested(), "staff-bob", "t1");
    if (!approved.ok) throw new Error("approval refused");
    const recorded = recordDirectBankRefundInBooks(approved.value, {
      actorId: "staff-bob",
      paidOn: "2026-11-19",
      at: "t2",
    });
    expect(recorded.ok).toBe(true);
    if (!recorded.ok || recorded.value.status !== "recorded") return;
    expect(recorded.value.books).toEqual({
      creditNoteReference: "LAX-BID-CN-1",
      amountPence: 50_000,
      paidOn: "2026-11-19",
    });
    expect(
      recordDirectBankRefundInBooks(recorded.value, {
        actorId: "x",
        paidOn: "2026-11-20",
        at: "t3",
      }),
    ).toEqual(recorded);
  });
});
