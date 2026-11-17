import { describe, expect, it, vi } from "vitest";
import { EXPRESS_PAYMENT_FAILED_MESSAGE, type ExpressConfirmResult } from "./express-checkout-api";
import {
  type ExpressFlowPorts,
  handleExpressAddressChange,
  handleExpressConfirm,
  withServerUpdate,
} from "./express-checkout-flow";
import { WALLET_MESSAGES, type WalletConfirmEvent } from "./express-checkout-wallet";

const ORDER_ID = "22222222-2222-4222-8222-222222222222";

function ports(overrides: Partial<ExpressFlowPorts> = {}) {
  const calls: string[] = [];
  const base: ExpressFlowPorts = {
    audience: "guest",
    session: {
      sessionId: "cs_test_a1",
      shippingRates: [
        { id: "uk_insured_delivery", displayName: "Insured UK delivery", amountPence: 1_500 },
        {
          id: "collect_new_cavendish",
          displayName: "Collect from our London gallery",
          amountPence: 0,
        },
      ],
    },
    checkout: {
      confirm: vi.fn(async () => {
        calls.push("stripe.confirm");
        return { type: "success" as const };
      }),
      runServerUpdate: vi.fn(async (update: () => Promise<unknown>) => {
        calls.push("runServerUpdate");
        await update();
      }),
    },
    dispatch: vi.fn(),
    changeAddress: vi.fn(async () => ({ kind: "ok" as const })),
    confirmOrder: vi.fn(async (): Promise<ExpressConfirmResult> => {
      calls.push("shop.confirm");
      return { kind: "confirmed", orderId: ORDER_ID };
    }),
    cancelOrder: vi.fn(async () => undefined),
    refresh: vi.fn(),
    navigate: vi.fn(),
    origin: "https://test-shop.lax.bid",
  };
  return { ports: { ...base, ...overrides }, calls };
}

function confirmEvent(overrides: Partial<WalletConfirmEvent> = {}) {
  return {
    billingDetails: { name: "Grace Hopper", email: "grace@example.com", phone: "+447700900123" },
    shippingAddress: {
      name: "Grace Hopper",
      address: {
        line1: "1 New Cavendish St",
        city: "London",
        postal_code: "W1G 8UR",
        country: "GB",
      },
    },
    shippingRate: { id: "shr_1", displayName: "Insured UK delivery", amount: 1_500 },
    ...overrides,
    paymentFailed: vi.fn(),
  };
}

describe("express checkout confirm", () => {
  it("makes the order inside a server update, then pays and opens the confirmation", async () => {
    const { ports: p, calls } = ports();
    const event = confirmEvent();
    await handleExpressConfirm(p, event);
    expect(calls).toEqual(["runServerUpdate", "shop.confirm", "stripe.confirm"]);
    expect(p.confirmOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        shippingRateId: "uk_insured_delivery",
        email: "grace@example.com",
      }),
    );
    expect(p.checkout.confirm).toHaveBeenCalledWith({
      expressCheckoutConfirmEvent: event,
      redirect: "if_required",
      returnUrl: `https://test-shop.lax.bid/checkout/confirmation?orderId=${ORDER_ID}`,
    });
    expect(p.dispatch).toHaveBeenNthCalledWith(1, { type: "confirm_started" });
    expect(p.dispatch).toHaveBeenLastCalledWith({ type: "paid", orderId: ORDER_ID });
    expect(p.navigate).toHaveBeenCalledWith(`/checkout/confirmation?orderId=${ORDER_ID}`);
    expect(event.paymentFailed).not.toHaveBeenCalled();
  });

  it("fails the sheet before any order when the wallet left out the phone", async () => {
    const { ports: p } = ports();
    const event = confirmEvent({ billingDetails: { name: "Grace", email: "g@example.com" } });
    await handleExpressConfirm(p, event);
    expect(p.confirmOrder).not.toHaveBeenCalled();
    expect(event.paymentFailed).toHaveBeenCalled();
    expect(p.dispatch).toHaveBeenLastCalledWith({
      type: "not_charged",
      message: WALLET_MESSAGES.phone,
    });
  });

  it("says the print sold out and reloads the basket", async () => {
    const { ports: p } = ports({
      confirmOrder: vi.fn(async () => ({
        kind: "sold_out" as const,
        message: "This print has just sold out",
      })),
    });
    const event = confirmEvent();
    await handleExpressConfirm(p, event);
    expect(event.paymentFailed).toHaveBeenCalled();
    expect(p.checkout.confirm).not.toHaveBeenCalled();
    expect(p.dispatch).toHaveBeenLastCalledWith({
      type: "sold_out",
      message: "This print has just sold out",
    });
    expect(p.refresh).toHaveBeenCalledOnce();
  });

  it("passes a bind mismatch through as not charged, without paying", async () => {
    const message =
      "We couldn't set up this payment, so you have not been charged. Start again from your basket.";
    const { ports: p } = ports({
      confirmOrder: vi.fn(async () => ({ kind: "not_charged" as const, message })),
    });
    const event = confirmEvent();
    await handleExpressConfirm(p, event);
    expect(p.checkout.confirm).not.toHaveBeenCalled();
    expect(p.dispatch).toHaveBeenLastCalledWith({ type: "not_charged", message });
    expect(p.cancelOrder).not.toHaveBeenCalled();
  });

  it("releases the order when Stripe declines the payment", async () => {
    const { ports: p } = ports();
    p.checkout.confirm = vi.fn(async () => ({
      type: "error" as const,
      error: { message: "Your card was declined." },
    }));
    const event = confirmEvent();
    await handleExpressConfirm(p, event);
    expect(p.dispatch).toHaveBeenLastCalledWith({
      type: "not_charged",
      message: EXPRESS_PAYMENT_FAILED_MESSAGE,
    });
    expect(p.cancelOrder).toHaveBeenCalledWith(ORDER_ID);
    expect(p.navigate).not.toHaveBeenCalled();
  });

  it("fails the sheet if the Shop cannot be reached", async () => {
    const { ports: p } = ports({
      confirmOrder: vi.fn(async () => {
        throw new Error("network");
      }),
    });
    const event = confirmEvent();
    await handleExpressConfirm(p, event);
    expect(event.paymentFailed).toHaveBeenCalled();
    expect(p.cancelOrder).not.toHaveBeenCalled();
    expect(p.dispatch).toHaveBeenLastCalledWith({
      type: "not_charged",
      message: EXPRESS_PAYMENT_FAILED_MESSAGE,
    });
  });
});

describe("express checkout address change", () => {
  it("keeps the rates for a UK address", async () => {
    const { ports: p } = ports();
    const event = {
      address: { country: "GB", postal_code: "W1G" },
      resolve: vi.fn(),
      reject: vi.fn(),
    };
    await handleExpressAddressChange(p, event);
    expect(p.changeAddress).toHaveBeenCalledWith({ country: "GB", postcode: "W1G" });
    expect(event.resolve).toHaveBeenCalled();
    expect(event.reject).not.toHaveBeenCalled();
  });

  it("refuses an address abroad and says why under the buttons", async () => {
    const { ports: p } = ports({
      changeAddress: vi.fn(async () => ({ kind: "refused" as const, message: "UK only" })),
    });
    const event = { address: { country: "FR" }, resolve: vi.fn(), reject: vi.fn() };
    await handleExpressAddressChange(p, event);
    expect(event.reject).toHaveBeenCalled();
    expect(p.dispatch).toHaveBeenCalledWith({ type: "address_refused", message: "UK only" });
  });
});

describe("withServerUpdate", () => {
  it("returns the update's value with or without runServerUpdate", async () => {
    expect(await withServerUpdate({}, async () => 7)).toBe(7);
    expect(
      await withServerUpdate({ runServerUpdate: async (update) => update() }, async () => 8),
    ).toBe(8);
  });

  it("refuses a server update that never ran the Shop's call", async () => {
    await expect(
      withServerUpdate({ runServerUpdate: async () => undefined }, async () => 9),
    ).rejects.toThrow();
  });
});
