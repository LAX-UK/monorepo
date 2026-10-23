import { describe, expect, it } from "vitest";
import { buildAttentionRows } from "./portfolio-attention.vm";
import { item } from "./portfolio-fixtures.test-util";

describe("buildAttentionRows", () => {
  it("sends an unpaid invoice to the product's pay link", () => {
    const rows = buildAttentionRows([
      item({
        status: "awaiting_payment",
        actions: [{ kind: "pay", href: "https://lax.bid/dashboard/checkout/1" }],
      }),
    ]);
    expect(rows).toEqual([
      {
        key: "bid:lot-1",
        text: "Pay for Green Line",
        href: "https://lax.bid/dashboard/checkout/1",
        external: true,
      },
    ]);
  });

  it("falls back to the work's page when the product link is unusable", () => {
    const [row] = buildAttentionRows([
      item({
        id: "a/b",
        status: "awaiting_payment",
        actions: [{ kind: "pay", href: "javascript:alert(1)" }],
      }),
    ]);
    expect(row).toMatchObject({ href: "/account/portfolio/bid/a%2Fb", external: false });
  });

  it("follows a shipment, a pending payout and a missing invoice", () => {
    const rows = buildAttentionRows([
      item({
        id: "ship",
        status: "awaiting_shipment",
        actions: [{ kind: "track_shipping", href: "https://lax.bid/track/1" }],
      }),
      item({ id: "payout", status: "payout_pending" }),
      item({ id: "doc", documents: [{ kind: "invoice", available: false }] }),
    ]);
    expect(rows.map((row) => row.text)).toEqual([
      "Track shipping for Green Line",
      "Payout pending for Green Line",
      "Invoice for Green Line is not available yet",
    ]);
  });

  it("has nothing to say about settled works", () => {
    expect(
      buildAttentionRows([
        item({ documents: [{ kind: "invoice", available: true, href: "https://lax.bid/i/1" }] }),
      ]),
    ).toEqual([]);
  });
});
