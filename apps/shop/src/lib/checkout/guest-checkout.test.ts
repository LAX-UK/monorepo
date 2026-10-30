import { describe, expect, it } from "vitest";
import {
  GUEST_EMAIL_MESSAGES,
  guestEmailStepResult,
  guestOrderStartResult,
} from "./guest-checkout";
import {
  GUEST_ORDER_INVOICE_PATH,
  buildGuestOrderDetailVm,
  guestOrderLinkDestination,
  guestOrderLinkProblem,
} from "./guest-order.vm";

describe("guest email step", () => {
  it("continues or asks to sign in on the API's answer", () => {
    expect(guestEmailStepResult(200, { outcome: "continue_as_guest" })).toEqual({
      kind: "continue_as_guest",
    });
    expect(guestEmailStepResult(200, { outcome: "sign_in_required" })).toEqual({
      kind: "sign_in_required",
    });
  });

  it("names each problem with its own next step", () => {
    expect(guestEmailStepResult(429, {})).toEqual({
      kind: "error",
      problem: "rate_limited",
      message: GUEST_EMAIL_MESSAGES.rate_limited,
    });
    expect(guestEmailStepResult(503, {})).toMatchObject({ problem: "unavailable" });
    expect(guestEmailStepResult(400, {})).toMatchObject({ problem: "invalid_email" });
    expect(guestEmailStepResult(500, null)).toMatchObject({ problem: "failed" });
  });
});

describe("guest order start", () => {
  it("opens the payment page, or sends a known email to sign in", () => {
    expect(guestOrderStartResult(200, { checkoutUrl: "https://pay.example/s" })).toEqual({
      kind: "redirect",
      checkoutUrl: "https://pay.example/s",
    });
    expect(
      guestOrderStartResult(409, {
        error: "commerce_upstream_failed",
        code: "shop.account_exists",
      }),
    ).toEqual({ kind: "sign_in_required" });
  });
});

describe("guest order links", () => {
  it("lands on the order or on what went wrong, never echoing the token", () => {
    expect(guestOrderLinkDestination("valid")).toBe("/orders/guest");
    expect(guestOrderLinkDestination("expired")).toBe("/orders/guest?link=expired");
    expect(guestOrderLinkDestination(null)).toBe("/orders/guest?link=invalid");
    expect(guestOrderLinkProblem("claimed")).toBe("claimed");
    expect(guestOrderLinkProblem("anything")).toBeNull();
  });

  it("shows a guest the invoice from the guest route and no account-only actions", () => {
    const vm = buildGuestOrderDetailVm(
      {
        orderId: "8f0a1c2e-3b4d-4e5f-8a6b-7c8d9e0f1a2b",
        reference: "LAX-S-10482",
        status: "paid",
        fulfilment: "collect_new_cavendish",
        merchandiseSubtotalPence: 12000,
        fulfilmentSurchargePence: 0,
        totalPence: 12000,
        refundedPence: 0,
        lines: [],
        createdAt: "2026-10-30T12:00:00.000Z",
        paidAt: "2026-10-30T12:05:00.000Z",
        invoiceAvailable: true,
      } as never,
      new Date("2026-10-30T13:00:00Z"),
    );
    expect(vm.invoiceHref).toBe(GUEST_ORDER_INVOICE_PATH);
    expect(vm.finishPaying).toBeNull();
    expect(vm.problem).toBeNull();
  });
});
