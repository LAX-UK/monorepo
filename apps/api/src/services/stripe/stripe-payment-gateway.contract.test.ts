import { describe, expect, it } from "vitest";
import { defineCompileTimeContract } from "../../testing/compile-time-contract.js";
import type {
  IStripeCaptureRefundGateway,
  IStripeCheckoutGateway,
  IStripePaymentGateway,
  StripePaymentGateway,
} from "./stripe-payment-gateway.js";

/**
 * Compile-time LSP contract: gateway facade must remain substitutable for segregated interfaces.
 */
type AssertAssignable<T extends U, U> = T;

declare const gateway: StripePaymentGateway;

type _Checkout = AssertAssignable<typeof gateway, IStripeCheckoutGateway>;
type _CaptureRefund = AssertAssignable<typeof gateway, IStripeCaptureRefundGateway>;
type _Composite = AssertAssignable<typeof gateway, IStripePaymentGateway>;

type _GatewayContract = [_Checkout, _CaptureRefund, _Composite];

defineCompileTimeContract<_GatewayContract>();

describe("StripePaymentGateway contract", () => {
  it("compile-time LSP types are exported for CI typecheck", () => {
    expect(true).toBe(true);
  });
});
