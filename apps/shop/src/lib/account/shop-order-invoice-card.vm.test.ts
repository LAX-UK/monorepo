import type { ShopOrderInvoiceCard } from "@auction/shop-contracts";
import { describe, expect, it } from "vitest";
import {
  SHOP_INVOICE_CARD_COPY,
  shopOrderDocumentHref,
  shopOrderInvoiceCard,
} from "./shop-order-invoice-card.vm";

const ORDER_ID = "550e8400-e29b-41d4-a716-846655440001";
const DOCUMENT_ID = "550e8400-e29b-41d4-a716-846655440077";
const NOW = new Date("2026-11-20T12:00:00Z");

const card = (over: Partial<ShopOrderInvoiceCard>): ShopOrderInvoiceCard => ({
  state: "lax",
  invoiceNumber: null,
  issuedAt: null,
  invoiceDocumentId: null,
  cancelledAt: null,
  ...over,
});

describe("shopOrderInvoiceCard", () => {
  it("leaves the page as it was when there is no card, or Books does not issue it", () => {
    expect(shopOrderInvoiceCard({ orderId: ORDER_ID, card: null, now: NOW })).toEqual({
      kind: "lax",
    });
    expect(shopOrderInvoiceCard({ orderId: ORDER_ID, card: card({}), now: NOW })).toEqual({
      kind: "lax",
    });
  });

  it("is being prepared, in the approved words, with nothing to download yet", () => {
    expect(
      shopOrderInvoiceCard({ orderId: ORDER_ID, card: card({ state: "preparing" }), now: NOW }),
    ).toEqual({
      kind: "preparing",
      title: "Invoice being prepared",
      detail: "We'll email your invoice as soon as it's ready.",
      note: "PDF available once issued",
    });
  });

  it("says it is late, in the approved words", () => {
    const vm = shopOrderInvoiceCard({
      orderId: ORDER_ID,
      card: card({ state: "delayed" }),
      now: NOW,
    });
    expect(vm).toMatchObject({
      kind: "delayed",
      title: SHOP_INVOICE_CARD_COPY.preparingTitle,
      detail:
        "This is taking longer than usual. Our team has been told. Your payment is not affected.",
    });
  });

  it("issued: the number, when Books issued it (London), and LAX's stored copy", () => {
    const vm = shopOrderInvoiceCard({
      orderId: ORDER_ID,
      card: card({
        state: "issued",
        invoiceNumber: "LAX-INV-000124",
        issuedAt: "2026-11-12T14:05:00.000Z",
        invoiceDocumentId: DOCUMENT_ID,
      }),
      now: NOW,
    });
    expect(vm).toEqual({
      kind: "issued",
      title: "Invoice LAX-INV-000124",
      meta: "Issued Thu 12 Nov, 14:05 GMT",
      download: {
        label: "Download invoice (PDF)",
        href: `/account/orders/${ORDER_ID}/documents/${DOCUMENT_ID}`,
      },
    });
  });

  it("never shows a number without its stored copy", () => {
    const vm = shopOrderInvoiceCard({
      orderId: ORDER_ID,
      card: card({ state: "issued", invoiceNumber: "LAX-INV-000124", issuedAt: null }),
      now: NOW,
    });
    expect(vm).toEqual({ kind: "lax" });
  });

  it("cancelled: the day only, in London", () => {
    const vm = shopOrderInvoiceCard({
      orderId: ORDER_ID,
      // 23:30 on Sunday 15 Nov in London is still the 15th there, whatever UTC says.
      card: card({ state: "cancelled", cancelledAt: "2026-11-15T23:30:00.000Z" }),
      now: NOW,
    });
    expect(vm).toEqual({
      kind: "cancelled",
      title: "Invoice cancelled",
      detail: "This invoice was cancelled on Sun 15 Nov. You owe nothing on it.",
    });
  });

  it("builds the download path from the ids, encoded", () => {
    expect(shopOrderDocumentHref("a/b", "c d")).toBe("/account/orders/a%2Fb/documents/c%20d");
  });
});
