import { describe, expect, it } from "vitest";
import type { ExpressCheckoutSnapshot } from "../application/ports/express-checkout.ports.js";
import { expressBindMismatch } from "./shop-checkout-express-session.js";

const ORDER = "11111111-1111-4111-8111-111111111111";
const SHIPPING = {
  name: "Ada Lovelace",
  line1: "1 High Street",
  city: "London",
  postcode: "SW1A 1AA",
  country: "GB" as const,
};
const EXPECTED = {
  orderId: ORDER,
  totalPence: 9_500,
  fulfilmentSurchargePence: 1_500,
  shipping: SHIPPING,
};

function bound(overrides: Partial<ExpressCheckoutSnapshot> = {}): ExpressCheckoutSnapshot {
  return {
    sessionId: "cs_test_express",
    status: "open",
    isShopExpress: true,
    basketId: "22222222-2222-4222-8222-222222222222",
    orderId: ORDER,
    currency: "gbp",
    amountSubtotalPence: 8_000,
    amountTotalPence: 9_500,
    shippingOptionAmountsPence: [1_500],
    shippingDetails: { ...SHIPPING, line2: null, postcode: "sw1a1aa" },
    bindRevision: 1,
    ...overrides,
  };
}

describe("expressBindMismatch", () => {
  it("accepts a session that pays exactly the order", () => {
    expect(expressBindMismatch(bound(), EXPECTED)).toBeNull();
  });

  it.each([
    ["session_missing", null],
    ["session_not_open", bound({ status: "expired" })],
    ["order_id", bound({ orderId: null })],
    ["currency", bound({ currency: "eur" })],
    ["amount_total", bound({ amountTotalPence: 8_000 })],
    ["shipping_option", bound({ shippingOptionAmountsPence: [0] })],
    ["shipping_option", bound({ shippingOptionAmountsPence: [1_500, 0] })],
    ["shipping_details", bound({ shippingDetails: null })],
    [
      "shipping_details",
      bound({ shippingDetails: { ...SHIPPING, line1: "2 Low Road", line2: null } }),
    ],
    ["shipping_details", bound({ shippingDetails: { ...SHIPPING, line2: "Flat 2" } })],
    [
      "shipping_details",
      bound({ shippingDetails: { ...SHIPPING, postcode: "EC1A 1BB", line2: null } }),
    ],
  ])("names %s when the session differs", (reason, session) => {
    expect(expressBindMismatch(session, EXPECTED)).toBe(reason);
  });
});
