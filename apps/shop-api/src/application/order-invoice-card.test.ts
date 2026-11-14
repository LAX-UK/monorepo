import { describe, expect, it, vi } from "vitest";
import { createOrderInvoiceCardService, orderCancelledAt } from "./order-invoice-card.js";
import type {
  OrderInvoiceBooks,
  OrderInvoiceBooksDocument,
} from "./ports/order-invoice-books.port.js";

const ORDER_ID = "5b6a7c1e-1111-4a5b-8c9d-000000000001";
const DOC_ID = "5b6a7c1e-9999-4a5b-8c9d-000000000009";
const PAID_AT = new Date("2026-11-12T14:05:00Z");
const ISSUED_AT = new Date("2026-11-12T14:07:00Z");

const order = (
  over: Partial<Parameters<ReturnType<typeof createOrderInvoiceCardService>["card"]>[0]> = {},
) => ({
  orderId: ORDER_ID,
  status: "paid" as const,
  paidAt: PAID_AT,
  refunds: [],
  ...over,
});

const doc = (over: Partial<OrderInvoiceBooksDocument> = {}): OrderInvoiceBooksDocument => ({
  documentId: DOC_ID,
  targetMode: "live",
  state: "issued",
  providerNumber: "LAX-INV-000124",
  issuedAt: ISSUED_AT,
  copy: { storageKey: `accounting/london_art_exchange/${DOC_ID}.pdf`, rehearsal: false },
  ...over,
});

function setUp(books: OrderInvoiceBooks | Error, minutesAfterPaid = 1) {
  const getObjectBytes = vi.fn(async () => Buffer.from("%PDF-1.4"));
  const service = createOrderInvoiceCardService({
    books: {
      read: async () => {
        if (books instanceof Error) throw books;
        return books;
      },
    },
    storage: { getObjectBytes },
    now: () => new Date(PAID_AT.getTime() + minutesAfterPaid * 60_000),
  });
  return { service, getObjectBytes };
}

describe("Shop order invoice card", () => {
  it("issued: the number, the issue event's time and LAX's stored copy", async () => {
    const { service } = setUp({ booksMode: "live", documents: [doc()] });
    expect(await service.card(order())).toEqual({
      state: "issued",
      invoiceNumber: "LAX-INV-000124",
      issuedAt: ISSUED_AT.toISOString(),
      invoiceDocumentId: DOC_ID,
      cancelledAt: null,
      refundedAt: null,
    });
  });

  it("preparing, then delayed after 30 minutes, while Books has not issued it with a copy", async () => {
    const pending = {
      booksMode: "live" as const,
      documents: [doc({ state: "pending", providerNumber: null, issuedAt: null, copy: null })],
    };
    expect((await setUp(pending, 29).service.card(order())).state).toBe("preparing");
    expect((await setUp(pending, 31).service.card(order())).state).toBe("delayed");
    // Issued but no copy yet: still preparing, never a number without its copy.
    const noCopy = await setUp({
      booksMode: "live",
      documents: [doc({ copy: null })],
    }).service.card(order());
    expect(noCopy).toMatchObject({
      state: "preparing",
      invoiceNumber: null,
      invoiceDocumentId: null,
    });
  });

  it("the page is unchanged (lax) in a dry run, at the test organisation, off, or unreadable", async () => {
    for (const booksMode of [null, "dry_run", "test_org"] as const) {
      const card = await setUp({
        booksMode,
        documents: [doc({ targetMode: booksMode ?? "live" })],
      }).service.card(order());
      expect(card).toEqual({
        state: "lax",
        invoiceNumber: null,
        issuedAt: null,
        invoiceDocumentId: null,
        cancelledAt: null,
        refundedAt: null,
      });
    }
    expect((await setUp(new Error("db down")).service.card(order())).state).toBe("lax");
    expect(
      (await setUp({ booksMode: "live", documents: [doc()] }).service.card(order({ paidAt: null })))
        .state,
    ).toBe("lax");
  });

  const refundedAt = new Date("2026-11-16T10:00:00Z");
  const refund = {
    amountPence: 1,
    source: "admin" as const,
    status: "succeeded" as const,
    requestedAt: refundedAt,
    refundedAt,
  };

  it("a refunded order keeps its issued invoice, and says when the refund was made", async () => {
    for (const status of ["refunded", "partially_refunded"] as const) {
      const card = await setUp({ booksMode: "live", documents: [doc()] }).service.card(
        order({ status, refunds: [refund] }),
      );
      expect(card).toEqual({
        state: "issued",
        invoiceNumber: "LAX-INV-000124",
        issuedAt: ISSUED_AT.toISOString(),
        invoiceDocumentId: DOC_ID,
        cancelledAt: null,
        refundedAt: refundedAt.toISOString(),
      });
    }
  });

  it("cancelled: a cancelled order gives the day its cancellation refund went through", async () => {
    const card = await setUp({ booksMode: "live", documents: [doc()] }).service.card(
      order({ status: "cancelled", refunds: [refund] }),
    );
    expect(card).toMatchObject({
      state: "cancelled",
      cancelledAt: refundedAt.toISOString(),
      invoiceNumber: null,
      refundedAt: null,
    });
  });
});

describe("Shop order invoice document (LAX's stored copy)", () => {
  it("serves the live, issued, non-rehearsal copy under London Art Exchange", async () => {
    const { service, getObjectBytes } = setUp({ booksMode: "live", documents: [doc()] });
    const pdf = await service.document(order(), DOC_ID);
    expect(pdf?.filename).toBe("invoice-LAX-INV-000124.pdf");
    expect(getObjectBytes).toHaveBeenCalledWith(
      `accounting/london_art_exchange/${DOC_ID}.pdf`,
      10 * 1024 * 1024,
    );
  });

  it.each([
    [
      "a rehearsal copy, though issued live",
      {
        booksMode: "live" as const,
        documents: [
          doc({
            copy: { storageKey: `accounting/london_art_exchange/${DOC_ID}.pdf`, rehearsal: true },
          }),
        ],
      },
    ],
    [
      "a dry run's document with a real copy",
      { booksMode: "dry_run" as const, documents: [doc({ targetMode: "dry_run" })] },
    ],
    [
      "the test organisation's document",
      { booksMode: "test_org" as const, documents: [doc({ targetMode: "test_org" })] },
    ],
    [
      "a document not issued",
      { booksMode: "live" as const, documents: [doc({ state: "needs_review" })] },
    ],
    [
      "a copy outside London Art Exchange's accounting copies",
      {
        booksMode: "live" as const,
        documents: [
          doc({
            copy: {
              storageKey: `accounting/london_auction_xchange/${DOC_ID}.pdf`,
              rehearsal: false,
            },
          }),
        ],
      },
    ],
    [
      "a document another order holds (the id is not this order's)",
      {
        booksMode: "live" as const,
        documents: [doc({ documentId: "5b6a7c1e-8888-4a5b-8c9d-000000000008" })],
      },
    ],
  ])("refuses %s, reading nothing from storage", async (_why, books) => {
    const { service, getObjectBytes } = setUp(books);
    expect(await service.document(order(), DOC_ID)).toBeNull();
    expect(getObjectBytes).not.toHaveBeenCalled();
  });

  it("serves a refunded order's invoice: a refund does not cancel it", async () => {
    const { service, getObjectBytes } = setUp({ booksMode: "live", documents: [doc()] });
    const refundedAt = new Date("2026-11-16T10:00:00Z");
    const pdf = await service.document(
      order({
        status: "refunded",
        refunds: [
          {
            amountPence: 1,
            source: "admin",
            status: "succeeded",
            requestedAt: refundedAt,
            refundedAt,
          },
        ],
      }),
      DOC_ID,
    );
    expect(pdf?.filename).toBe("invoice-LAX-INV-000124.pdf");
    expect(getObjectBytes).toHaveBeenCalledTimes(1);
  });

  it("refuses a cancelled order's invoice, reading nothing", async () => {
    const { service, getObjectBytes } = setUp({ booksMode: "live", documents: [doc()] });
    expect(await service.document(order({ status: "cancelled" }), DOC_ID)).toBeNull();
    expect(getObjectBytes).not.toHaveBeenCalled();
  });
});

describe("orderCancelledAt", () => {
  it("is null while the order stands, refunded in part or in full included", () => {
    expect(orderCancelledAt(order({ status: "partially_refunded" }))).toBeNull();
    expect(orderCancelledAt(order({ status: "refunded" }))).toBeNull();
    expect(orderCancelledAt(order({ status: "cancelled" }))).toEqual(PAID_AT);
  });
});
