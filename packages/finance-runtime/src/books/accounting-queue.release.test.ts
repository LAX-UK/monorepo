import {
  type AccountingDocument,
  type BidPaymentGroupFacts,
  type DocumentRecord,
  type LineBooking,
  type Result,
  ok,
  parkedRecord,
  projectBidPaymentGroupSettled,
  refuse,
  release,
} from "@auction/accounting-domain";
import type {
  DocumentTransition,
  StoredAccountingDocument,
  TransitionCode,
} from "@auction/persistence/interfaces";
import { describe, expect, it } from "vitest";
import { AccountingQueueService } from "./accounting-queue.service.js";

const BUYER = { legalEntityId: "0b6a7c1e-2222-4a5b-8c9d-000000000002", name: "Ada", email: null };
const GROUP_ID = "0b6a7c1e-5555-4a5b-8c9d-000000000005";
const QUOTE_ID = "0b6a7c1e-6666-4a5b-8c9d-000000000006";
const ZERO_RATED: LineBooking = { role: "delivery", treatment: "zero" };

const group: BidPaymentGroupFacts = {
  groupId: GROUP_ID,
  buyer: BUYER,
  currency: "GBP",
  totalPence: 11_000,
  settledOn: "2026-11-14",
  members: [
    {
      paymentId: "0b6a7c1e-3333-4a5b-8c9d-000000000003",
      amountPence: 10_000,
      invoice: {
        invoiceId: "0b6a7c1e-1111-4a5b-8c9d-000000000001",
        buyer: BUYER,
        raisedOn: "2026-11-12",
        dueOn: "2026-11-26",
        lines: [{ kind: "hammer", label: "Hammer price", amountPence: 10_000 }],
      },
    },
  ],
  deliveries: [{ quoteId: QUOTE_ID, amountPence: 1_000 }],
};

const projected = projectBidPaymentGroupSettled(group);
if (!projected.ok) throw new Error(projected.refusal.message);
const documents = projected.value.documents;
const delivery = documents.find((d) => d.reference.includes("dlv-")) as AccountingDocument;
const payment = documents.find((d) => d.kind === "payment") as AccountingDocument;
const lotInvoice = documents.find(
  (d) => d.kind === "invoice" && !d.reference.includes("dlv-"),
) as AccountingDocument;

function stored(document: AccountingDocument, record: DocumentRecord): StoredAccountingDocument {
  return {
    id: `id-${document.reference}`,
    product: "bid",
    legalEntity: "london_auction_xchange",
    kind: document.kind,
    reference: document.reference,
    sourceEventRef: "evt-1",
    document,
    totals: { netPence: 0, vatPence: 0, grossPence: 0 },
    provider: null,
    target: { provider: "books", mode: "dry_run" },
    record,
    lastErrorClass: null,
    createdAt: new Date("2026-11-14T10:00:00Z"),
    updatedAt: new Date("2026-11-14T10:00:00Z"),
  };
}

function setUp(
  rows: readonly StoredAccountingDocument[],
  deliveryBooking: LineBooking | null = null,
) {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const applied: DocumentTransition[] = [];
  const audits: unknown[] = [];
  const service = new AccountingQueueService({
    browser: {
      list: async () => {
        throw new Error("unused");
      },
      findById: async (id) => ok(byId.get(id) ?? null),
      awaitedOf: async () => new Map(),
    },
    partFunded: { list: async () => [] },
    transitions: {
      apply: async (
        id: string,
        transition: DocumentTransition,
      ): Promise<Result<StoredAccountingDocument, TransitionCode>> => {
        applied.push(transition);
        const row = byId.get(id);
        if (!row) return refuse("not_found", "no such document");
        const next = release(row.record);
        if (!next.ok) return next;
        const moved = { ...row, record: next.value };
        byId.set(id, moved);
        return ok(moved);
      },
    },
    audit: {
      retryRequested: async () => {},
      releaseRequested: async (input) => void audits.push(input),
    },
    booksLink: () => null,
    facts: {
      invoiceRaised: async () => ({ status: "skip", reason: "unused" }),
      paymentCaptured: async () => ({ status: "skip", reason: "payment_not_found" }),
      paymentRefunded: async () => ({ status: "skip", reason: "unused" }),
      paymentGroupSettled: async (id) =>
        id === GROUP_ID
          ? { status: "ready", facts: group }
          : { status: "skip", reason: "payment_group_not_found" },
      deliveryGroupOf: async (quoteId) => (quoteId === QUOTE_ID ? GROUP_ID : null),
    },
    lookup: {
      findByReference: async (_product, reference) =>
        ok([...byId.values()].find((row) => row.reference === reference) ?? null),
    },
    deliveryBooking,
  });
  return { service, applied, audits };
}

const parkedDelivery = stored(
  delivery,
  parkedRecord("invoice", delivery.reference, "vat_on_delivery"),
);
const parkedPayment = stored(
  payment,
  parkedRecord("payment", payment.reference, "vat_on_delivery"),
);
const ask = (row: StoredAccountingDocument) => ({ documentId: row.id, actorUserId: "staff-1" });

describe("AccountingQueueService.release", () => {
  it("refuses a parked delivery invoice and its payment while VAT on delivery is not settled", async () => {
    const { service, applied, audits } = setUp([parkedDelivery, parkedPayment]);
    for (const row of [parkedDelivery, parkedPayment]) {
      expect(await service.release(ask(row))).toMatchObject({
        ok: false,
        refusal: "unresolved",
        message: expect.stringMatching(/accountant has not yet confirmed/),
      });
    }
    expect(applied).toEqual([]);
    expect(audits).toEqual([]);
  });

  it("with the booking set, releases the delivery invoice rebuilt from the stored rows, then the payment unchanged", async () => {
    const { service, applied, audits } = setUp([parkedDelivery, parkedPayment], ZERO_RATED);
    expect(await service.release(ask(parkedDelivery))).toEqual({
      ok: true,
      value: {
        id: parkedDelivery.id,
        reference: delivery.reference,
        outcome: "released",
        rebuilt: true,
      },
    });
    expect(applied[0]).toMatchObject({
      action: "release",
      requestedBy: "staff-1",
      document: { reference: delivery.reference, lines: [{ treatment: "zero" }] },
    });
    expect(await service.release(ask(parkedPayment))).toMatchObject({
      ok: true,
      value: { outcome: "released", rebuilt: false },
    });
    expect(applied[1]).toEqual({ action: "release", requestedBy: "staff-1" });
    expect(audits).toEqual([
      expect.objectContaining({
        actorUserId: "staff-1",
        payload: expect.objectContaining({ parked: "vat_on_delivery", rebuilt: true }),
      }),
      expect.objectContaining({
        payload: expect.objectContaining({ parked: "vat_on_delivery", rebuilt: false }),
      }),
    ]);
    // Asking again changes nothing more.
    expect(await service.release(ask(parkedPayment))).toMatchObject({
      ok: true,
      value: { outcome: "already_queued" },
    });
    expect(applied).toHaveLength(2);
  });

  it("does not release a payment whose invoice was cancelled in Accounting", async () => {
    const cancelledInvoice = stored(lotInvoice, {
      kind: "invoice",
      reference: lotInvoice.reference,
      attempts: 0,
      status: "cancelled",
    });
    const { service, applied } = setUp([parkedPayment, cancelledInvoice], ZERO_RATED);
    expect(await service.release(ask(parkedPayment))).toMatchObject({
      ok: false,
      refusal: "unresolved",
      message: expect.stringMatching(/cancelled in Accounting/),
    });
    expect(applied).toEqual([]);
  });

  it("refuses what is not parked, what cannot be rebuilt, and what does not exist", async () => {
    const failed = stored(lotInvoice, {
      kind: "invoice",
      reference: lotInvoice.reference,
      attempts: 1,
      status: "failed",
      reason: "zoho_books_validation_invalid_request",
    });
    const single = stored(
      { ...payment, reference: "LAX-BID-PAY-0b6a7c1e-3333-4a5b-8c9d-0000000000ff" } as never,
      parkedRecord(
        "payment",
        "LAX-BID-PAY-0b6a7c1e-3333-4a5b-8c9d-0000000000ff",
        "invoice_cancelled",
      ),
    );
    const { service, applied } = setUp([failed, single], ZERO_RATED);
    expect(await service.release(ask(failed))).toMatchObject({ ok: false, refusal: "not_allowed" });
    expect(await service.release(ask(single))).toMatchObject({
      ok: false,
      refusal: "unresolved",
      message: expect.stringMatching(/no longer matches/),
    });
    expect(await service.release({ documentId: "nope", actorUserId: "staff-1" })).toMatchObject({
      ok: false,
      refusal: "not_found",
    });
    expect(applied).toEqual([]);
  });
});
