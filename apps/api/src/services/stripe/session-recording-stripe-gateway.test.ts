import { describe, expect, it, vi } from "vitest";
import { SessionRecordingStripeGateway } from "./session-recording-stripe-gateway.js";
import type {
  CreateCheckoutSessionInput,
  IStripePaymentGateway,
} from "./stripe-payment-gateway.js";

const input = { paymentId: "pay-1" } as CreateCheckoutSessionInput;

describe("SessionRecordingStripeGateway", () => {
  it("records each session it opens before the link is returned", async () => {
    const order: string[] = [];
    const inner = {
      createCardCheckoutSession: vi.fn(async () => {
        order.push("stripe");
        return {
          sessionId: "cs_1",
          url: "https://checkout.stripe.com/cs_1",
          paymentIntentId: null,
        };
      }),
      createBankTransferCheckoutSession: vi.fn(async () => ({
        sessionId: "cs_2",
        url: "https://checkout.stripe.com/cs_2",
        paymentIntentId: null,
      })),
    } as unknown as IStripePaymentGateway;
    const record = vi.fn(async () => {
      order.push("recorded");
    });
    const gateway = new SessionRecordingStripeGateway(inner, {
      record,
      listSessionIds: vi.fn().mockResolvedValue([]),
    });

    await expect(gateway.createCardCheckoutSession(input)).resolves.toMatchObject({
      sessionId: "cs_1",
    });
    await gateway.createBankTransferCheckoutSession({
      ...input,
      stripeCustomerId: "cus_1",
    } as never);

    expect(record).toHaveBeenNthCalledWith(1, "pay-1", "cs_1");
    expect(record).toHaveBeenNthCalledWith(2, "pay-1", "cs_2");
    expect(order.slice(0, 2)).toEqual(["stripe", "recorded"]);
  });

  it("does not hand out a link it could not record", async () => {
    const inner = {
      createCardCheckoutSession: vi.fn().mockResolvedValue({ sessionId: "cs_1", url: "u" }),
    } as unknown as IStripePaymentGateway;
    const gateway = new SessionRecordingStripeGateway(inner, {
      record: vi.fn().mockRejectedValue(new Error("db down")),
      listSessionIds: vi.fn().mockResolvedValue([]),
    });
    await expect(gateway.createCardCheckoutSession(input)).rejects.toThrow("db down");
  });

  const mismatch = () =>
    Object.assign(
      new Error("Keys for idempotent requests can only be used with the same parameters"),
      {
        type: "StripeIdempotencyError",
      },
    );

  it("closes the invoice's other recorded sessions, never the one it returned", async () => {
    const expireCheckoutSession = vi.fn().mockResolvedValue(undefined);
    const inner = {
      createCardCheckoutSession: vi
        .fn()
        .mockResolvedValue({ sessionId: "cs_new", url: "u", paymentIntentId: null }),
      expireCheckoutSession,
    } as unknown as IStripePaymentGateway;
    const gateway = new SessionRecordingStripeGateway(inner, {
      record: vi.fn().mockResolvedValue(undefined),
      listSessionIds: vi.fn().mockResolvedValue(["cs_old_1", "cs_new", "cs_old_2"]),
    });
    await gateway.createCardCheckoutSession(input);
    expect(expireCheckoutSession.mock.calls.map((c) => c[0])).toEqual(["cs_old_1", "cs_old_2"]);
  });

  it("when Stripe still refuses the key, opens under a fresh key and closes only the others", async () => {
    const keys: string[] = [];
    const createCardCheckoutSession = vi
      .fn()
      .mockRejectedValueOnce(mismatch())
      .mockImplementation(async (i: { idempotencyKey: string }) => {
        keys.push(i.idempotencyKey);
        return { sessionId: "cs_new", url: "u", paymentIntentId: null };
      });
    const expireCheckoutSession = vi.fn().mockResolvedValue(undefined);
    const inner = {
      createCardCheckoutSession,
      expireCheckoutSession,
    } as unknown as IStripePaymentGateway;
    const gateway = new SessionRecordingStripeGateway(inner, {
      record: vi.fn().mockResolvedValue(undefined),
      listSessionIds: vi.fn().mockResolvedValue(["cs_old", "cs_new"]),
    });
    await gateway.createCardCheckoutSession({
      ...input,
      idempotencyKey: "checkout:card:payment:pay-1:p:abc",
    });
    expect(keys[0]).toMatch(/^checkout:card:payment:pay-1:p:abc:clash:/);
    expect(expireCheckoutSession.mock.calls.map((c) => c[0])).toEqual(["cs_old"]);
  });

  it("other Stripe errors are not hidden", async () => {
    const inner = {
      createCardCheckoutSession: vi
        .fn()
        .mockRejectedValue(Object.assign(new Error("card_declined"), { type: "StripeCardError" })),
    } as unknown as IStripePaymentGateway;
    const gateway = new SessionRecordingStripeGateway(inner, {
      record: vi.fn(),
      listSessionIds: vi.fn(),
    });
    await expect(gateway.createCardCheckoutSession(input)).rejects.toThrow("card_declined");
  });
});
