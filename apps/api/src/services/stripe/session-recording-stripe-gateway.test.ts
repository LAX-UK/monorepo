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

  it("when Stripe refuses the key for changed parameters, closes every recorded session first", async () => {
    const order: string[] = [];
    const createCardCheckoutSession = vi
      .fn()
      .mockRejectedValueOnce(mismatch())
      .mockImplementation(async (i: { idempotencyKey: string }) => {
        order.push(`create:${i.idempotencyKey}`);
        return { sessionId: "cs_new", url: "u", paymentIntentId: null };
      });
    const expireCheckoutSession = vi.fn(async (id: string) => {
      order.push(`expire:${id}`);
    });
    const inner = {
      createCardCheckoutSession,
      expireCheckoutSession,
    } as unknown as IStripePaymentGateway;
    const record = vi.fn().mockResolvedValue(undefined);
    const gateway = new SessionRecordingStripeGateway(inner, {
      record,
      listSessionIds: vi.fn().mockResolvedValue(["cs_old_1", "cs_old_2"]),
    });
    await gateway.createCardCheckoutSession({
      ...input,
      idempotencyKey: "checkout:card:payment:pay-1",
    });
    expect(order.slice(0, 2)).toEqual(["expire:cs_old_1", "expire:cs_old_2"]);
    expect(order[2]).toMatch(/^create:checkout:card:payment:pay-1:p:[0-9a-f]{16}$/);
    expect(record).toHaveBeenCalledWith("pay-1", "cs_new");
  });

  it("a second parameter change gets a key of its own, so it does not fail again", async () => {
    const keys: string[] = [];
    const createCardCheckoutSession = vi.fn(async (i: { idempotencyKey: string }) => {
      keys.push(i.idempotencyKey);
      if (!i.idempotencyKey.includes(":p:")) throw mismatch();
      return { sessionId: "cs", url: "u", paymentIntentId: null };
    });
    const inner = {
      createCardCheckoutSession,
      expireCheckoutSession: vi.fn().mockResolvedValue(undefined),
    } as unknown as IStripePaymentGateway;
    const gateway = new SessionRecordingStripeGateway(inner, {
      record: vi.fn().mockResolvedValue(undefined),
      listSessionIds: vi.fn().mockResolvedValue([]),
    });
    const base = { ...input, idempotencyKey: "checkout:card:payment:pay-1" };
    await gateway.createCardCheckoutSession({ ...base, successUrl: "https://lax.bid/a" } as never);
    await gateway.createCardCheckoutSession({ ...base, successUrl: "https://lax.bid/b" } as never);
    const reissued = keys.filter((k) => k.includes(":p:"));
    expect(reissued).toHaveLength(2);
    expect(reissued[0]).not.toBe(reissued[1]);
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
