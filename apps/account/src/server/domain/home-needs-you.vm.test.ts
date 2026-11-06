import { describe, expect, it } from "vitest";
import { buildNeedsYou } from "./home-needs-you.vm";
import { buildAttentionRows } from "./portfolio-attention.vm";
import { item } from "./portfolio-fixtures.test-util";

const PAY = [{ kind: "pay" as const, href: "https://lax.bid/purchases/checkout/1" }];
const TRACK = [{ kind: "track_shipping" as const, href: "https://lax.bid/track/1" }];

function lines(...items: Parameters<typeof buildAttentionRows>[0]) {
  return buildNeedsYou(buildAttentionRows(items));
}

describe("buildNeedsYou", () => {
  it("puts payments before shipments whatever order the products answered in", () => {
    const { lines: result } = lines(
      item({ id: "ship", title: "Harbor Print", status: "awaiting_shipment", actions: TRACK }),
      item({
        id: "pay",
        title: "Coastal Notation",
        status: "awaiting_payment",
        owed: { amount: 237_500, currency: "GBP", state: "due" },
        actions: PAY,
      }),
    );
    expect(result.map((line) => line.title)).toEqual([
      "Pay for Coastal Notation",
      "Track shipping for Harbor Print",
    ]);
    expect(result[0]).toMatchObject({
      meta: "LAX Bid · £2,375.00",
      href: "https://lax.bid/purchases/checkout/1",
      action: { label: "Pay in LAX Bid", shortLabel: "Pay", onPhone: true, primary: true },
    });
    expect(result[1]?.action).toMatchObject({ label: "Track", onPhone: false, primary: false });
  });

  it("shows at most three lines and counts the rest", () => {
    const many = ["a", "b", "c", "d", "e"].map((id) =>
      item({ id, status: "awaiting_shipment", actions: TRACK }),
    );
    const result = lines(...many);
    expect(result.lines).toHaveLength(3);
    expect(result.moreCount).toBe(2);
  });

  it("has no more line when everything fits", () => {
    expect(lines(item({ status: "payout_pending" })).moreCount).toBe(0);
  });

  it("gives the card one primary button only", () => {
    const payment = (id: string) =>
      item({
        id,
        status: "awaiting_payment",
        owed: { amount: 10_000, currency: "GBP", state: "due" },
        actions: PAY,
      });
    const result = lines(payment("a"), payment("b"));
    expect(result.lines.map((line) => line.action?.primary)).toEqual([true, false]);
  });

  it("asks a held payment to verify instead of paying", () => {
    const [line] = lines(
      item({
        status: "awaiting_payment",
        owed: { amount: 237_500, currency: "GBP", state: "in_review", blocker: "documents" },
        actions: PAY,
      }),
    ).lines;
    expect(line).toMatchObject({
      title: "Pay for Green Line",
      meta: "Verify your identity to pay",
      action: { label: "Verify in LAX Bid", shortLabel: "Verify" },
    });
  });

  it("is empty when nothing needs the person", () => {
    expect(lines(item({ status: "owned" }))).toEqual({ lines: [], moreCount: 0 });
  });
});
