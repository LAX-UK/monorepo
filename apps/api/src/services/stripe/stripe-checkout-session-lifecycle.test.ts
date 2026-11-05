import type Stripe from "stripe";
import { describe, expect, it, vi } from "vitest";
import {
  createOrRenewCheckoutSession,
  isCheckoutSessionUsable,
} from "./stripe-checkout-session-lifecycle.js";
import type { IStripePaymentGateway } from "./stripe-payment-gateway.js";

describe("isCheckoutSessionUsable", () => {
  it("returns true for open sessions with a future expiry", () => {
    expect(
      isCheckoutSessionUsable({
        status: "open",
        url: "https://checkout.stripe.com/pay/cs_1",
        expires_at: Math.floor(Date.now() / 1000) + 3600,
      } as Stripe.Checkout.Session),
    ).toBe(true);
  });

  it("returns false for expired open sessions", () => {
    expect(
      isCheckoutSessionUsable({
        status: "open",
        url: "https://checkout.stripe.com/pay/cs_1",
        expires_at: Math.floor(Date.now() / 1000) - 60,
      } as Stripe.Checkout.Session),
    ).toBe(false);
  });
});

describe("createOrRenewCheckoutSession", () => {
  it("renews with a new idempotency key when the first session is expired", async () => {
    const create = vi
      .fn()
      .mockResolvedValueOnce({
        sessionId: "cs_old",
        url: "https://checkout.stripe.com/pay/cs_old",
        paymentIntentId: "pi_old",
      })
      .mockResolvedValueOnce({
        sessionId: "cs_new",
        url: "https://checkout.stripe.com/pay/cs_new",
        paymentIntentId: "pi_new",
      });

    const gateway = {
      retrieveCheckoutSession: vi
        .fn()
        .mockResolvedValueOnce({
          id: "cs_old",
          status: "expired",
          url: "https://checkout.stripe.com/pay/cs_old",
        })
        .mockResolvedValueOnce({
          id: "cs_new",
          status: "open",
          url: "https://checkout.stripe.com/pay/cs_new",
          expires_at: Math.floor(Date.now() / 1000) + 3600,
        }),
    } as unknown as IStripePaymentGateway;

    const outcome = await createOrRenewCheckoutSession(gateway, "card", "pay_1", create);

    expect(outcome).toEqual({
      kind: "ready",
      session: {
        sessionId: "cs_new",
        url: "https://checkout.stripe.com/pay/cs_new",
        paymentIntentId: "pi_new",
      },
    });
    expect(create).toHaveBeenCalledTimes(2);
    expect(create.mock.calls[0]?.[0]).toBe("checkout:card:payment:pay_1");
    expect(create.mock.calls[1]?.[0]).toBe("checkout:card:payment:pay_1:renewed:cs_old");
  });

  it("two requests renewing the same expired session use one key, so Stripe opens one session", async () => {
    const expired = { id: "cs_old", status: "expired", url: "https://checkout.stripe.com/x" };
    const fresh = {
      id: "cs_new",
      status: "open",
      url: "https://checkout.stripe.com/pay/cs_new",
      expires_at: Math.floor(Date.now() / 1000) + 3600,
    };
    const run = async () => {
      const create = vi.fn(async (key: string) => ({
        sessionId: key.includes(":renewed:") ? "cs_new" : "cs_old",
        url: "https://checkout.stripe.com/pay/cs",
        paymentIntentId: null,
      }));
      const gateway = {
        retrieveCheckoutSession: vi.fn(async (id: string) => (id === "cs_old" ? expired : fresh)),
      } as unknown as IStripePaymentGateway;
      await createOrRenewCheckoutSession(gateway, "card", "pay_1", create);
      return create.mock.calls.map((call) => call[0]);
    };
    const [first, second] = await Promise.all([run(), run()]);
    expect(first).toEqual(second);
    expect(first?.[1]).toBe("checkout:card:payment:pay_1:renewed:cs_old");
  });

  it("steps over a renewed session that has expired too, by the same rule", async () => {
    const create = vi.fn(async (key: string) => ({
      sessionId: key.endsWith(":renewed:cs_a")
        ? "cs_b"
        : key.endsWith(":renewed:cs_b")
          ? "cs_c"
          : "cs_a",
      url: "https://checkout.stripe.com/pay/cs",
      paymentIntentId: null,
    }));
    const gateway = {
      retrieveCheckoutSession: vi.fn(async (id: string) =>
        id === "cs_c"
          ? { id, status: "open", url: "u", expires_at: Math.floor(Date.now() / 1000) + 3600 }
          : { id, status: "expired", url: "u" },
      ),
    } as unknown as IStripePaymentGateway;
    const outcome = await createOrRenewCheckoutSession(gateway, "card", "pay_1", create);
    expect(outcome).toMatchObject({ kind: "ready", session: { sessionId: "cs_c" } });
    expect(create.mock.calls.map((c) => c[0])).toEqual([
      "checkout:card:payment:pay_1",
      "checkout:card:payment:pay_1:renewed:cs_a",
      "checkout:card:payment:pay_1:renewed:cs_b",
    ]);
  });

  it("returns already_complete when Stripe session is complete", async () => {
    const create = vi.fn().mockResolvedValue({
      sessionId: "cs_done",
      url: "https://checkout.stripe.com/pay/cs_done",
      paymentIntentId: "pi_done",
    });
    const gateway = {
      retrieveCheckoutSession: vi.fn().mockResolvedValue({
        id: "cs_done",
        status: "complete",
        url: "https://checkout.stripe.com/pay/cs_done",
      }),
    } as unknown as IStripePaymentGateway;

    const outcome = await createOrRenewCheckoutSession(gateway, "bank", "pay_2", create);
    expect(outcome).toEqual({ kind: "already_complete" });
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("a key Stripe refuses for changed parameters is reissued under one derived key", async () => {
    const mismatch = Object.assign(
      new Error("Keys for idempotent requests can only be used with the same parameters"),
      {
        type: "StripeIdempotencyError",
      },
    );
    const create = vi.fn().mockRejectedValueOnce(mismatch).mockResolvedValueOnce({
      sessionId: "cs_new",
      url: "https://checkout.stripe.com/pay/cs_new",
      paymentIntentId: null,
    });
    const gateway = {
      retrieveCheckoutSession: vi.fn().mockResolvedValue({
        id: "cs_new",
        status: "open",
        url: "https://checkout.stripe.com/pay/cs_new",
        expires_at: Math.floor(Date.now() / 1000) + 3600,
      }),
    } as unknown as IStripePaymentGateway;
    const outcome = await createOrRenewCheckoutSession(gateway, "card", "pay_1", create);
    expect(outcome).toMatchObject({ kind: "ready", session: { sessionId: "cs_new" } });
    expect(create.mock.calls.map((c) => c[0])).toEqual([
      "checkout:card:payment:pay_1",
      "checkout:card:payment:pay_1:reissued",
    ]);
  });

  it("other Stripe errors are not hidden", async () => {
    const create = vi
      .fn()
      .mockRejectedValue(Object.assign(new Error("card_declined"), { type: "StripeCardError" }));
    await expect(
      createOrRenewCheckoutSession({} as IStripePaymentGateway, "card", "pay_1", create),
    ).rejects.toThrow("card_declined");
  });
});
