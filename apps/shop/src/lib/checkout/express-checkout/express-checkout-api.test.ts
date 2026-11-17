import { describe, expect, it } from "vitest";
import {
  EXPRESS_NOT_CHARGED_MESSAGE,
  EXPRESS_UNAVAILABLE_MESSAGE,
  expressAddressResult,
  expressCheckoutPath,
  expressConfirmResult,
  expressConfirmationHref,
  expressStartResult,
} from "./express-checkout-api";

const ORDER_ID = "22222222-2222-4222-8222-222222222222";
const session = {
  sessionId: "cs_test_a1B2c3",
  clientSecret: "cs_test_a1B2c3_secret_x",
  expiresAt: "2026-11-17T12:30:00.000Z",
  currency: "gbp",
  subtotalPence: 45_000,
  shippingRates: [
    { id: "uk_insured_delivery", displayName: "Insured UK delivery", amountPence: 1_500 },
    { id: "collect_new_cavendish", displayName: "Collect from our London gallery", amountPence: 0 },
  ],
};

describe("express checkout API adapter", () => {
  it("routes guests and signed-in shoppers to their own BFF paths", () => {
    expect(expressCheckoutPath("account", "start")).toBe("/commerce/express-checkout");
    expect(expressCheckoutPath("account", "confirm")).toBe("/commerce/express-checkout/confirm");
    expect(expressCheckoutPath("guest", "start")).toBe("/commerce/guest-checkout/express-checkout");
    expect(expressCheckoutPath("guest", "shipping-address")).toBe(
      "/commerce/guest-checkout/express-checkout/shipping-address",
    );
  });

  it("reads a session, and hides the row when shop-api has express checkout off", () => {
    expect(expressStartResult(200, session)).toEqual({ kind: "ready", session });
    expect(
      expressStartResult(404, {
        error: "commerce_upstream_failed",
        code: "shop.feature_disabled",
        message: "Express checkout is not available",
      }),
    ).toEqual({ kind: "unavailable" });
  });

  it("gives one plain line for a malformed session or any other failure", () => {
    expect(expressStartResult(200, { ...session, clientSecret: "" })).toEqual({
      kind: "error",
      message: EXPRESS_UNAVAILABLE_MESSAGE,
    });
    expect(expressStartResult(503, {})).toEqual({
      kind: "error",
      message: EXPRESS_UNAVAILABLE_MESSAGE,
    });
    expect(expressStartResult(200, { ...session, sessionId: "pi_123" }).kind).toBe("error");
  });

  it("passes the UK-only refusal to the sheet as shop-api words it", () => {
    expect(expressAddressResult(200, { shippingRates: session.shippingRates })).toEqual({
      kind: "ok",
    });
    expect(
      expressAddressResult(400, {
        code: "shop.validation",
        message: "Express checkout delivers to UK addresses only.",
      }),
    ).toEqual({ kind: "refused", message: "Express checkout delivers to UK addresses only." });
    expect(expressAddressResult(500, {})).toEqual({
      kind: "refused",
      message: EXPRESS_UNAVAILABLE_MESSAGE,
    });
  });

  it("reads a confirmed order", () => {
    expect(
      expressConfirmResult(200, {
        orderId: ORDER_ID,
        returnUrl: `/checkout/confirmation?orderId=${ORDER_ID}`,
        expiresAt: "2026-11-17T12:30:00.000Z",
      }),
    ).toEqual({ kind: "confirmed", orderId: ORDER_ID });
  });

  it("says a print sold out in the design's words", () => {
    expect(
      expressConfirmResult(409, {
        error: "commerce_upstream_failed",
        code: "shop.out_of_stock",
        message: "This print has just sold out",
      }),
    ).toEqual({ kind: "sold_out", message: "This print has just sold out" });
  });

  it("ends the session in shop-api's words on a refused bind, ended session or changed basket", () => {
    for (const [code, message] of [
      [
        "shop.conflict",
        "We couldn't set up this payment, so you have not been charged. Start again from your basket.",
      ],
      ["shop.conflict", "This payment has ended. Start again from your basket."],
      ["shop.price_changed", "Your basket changed while you were paying. Check it and try again."],
    ] as const) {
      expect(expressConfirmResult(409, { code, message })).toEqual({ kind: "ended", message });
    }
    expect(expressConfirmResult(409, { code: "shop.basket_conflict" })).toEqual({
      kind: "ended",
      message: EXPRESS_NOT_CHARGED_MESSAGE,
    });
    expect(
      expressConfirmResult(404, { code: "shop.not_found", message: "Express checkout not found" }),
    ).toEqual({ kind: "ended", message: EXPRESS_NOT_CHARGED_MESSAGE });
  });

  it("never shows other conflict text as it is", () => {
    for (const message of [
      "Order is no longer checkoutable",
      "Order already paid",
      "Checkout session expired",
    ]) {
      expect(expressConfirmResult(409, { code: "shop.conflict", message })).toEqual({
        kind: "ended",
        message: EXPRESS_NOT_CHARGED_MESSAGE,
      });
    }
  });

  it("keeps other refusals to one plain line", () => {
    expect(expressConfirmResult(502, { error: "invalid_upstream" })).toEqual({
      kind: "error",
      message: EXPRESS_UNAVAILABLE_MESSAGE,
    });
    expect(expressConfirmResult(403, { error: "email_not_verified" }).kind).toBe("error");
    expect(expressConfirmResult(200, { orderId: "nope" }).kind).toBe("error");
  });

  it("sends the shopper to the existing order confirmation", () => {
    expect(expressConfirmationHref(ORDER_ID)).toBe(`/checkout/confirmation?orderId=${ORDER_ID}`);
  });
});
