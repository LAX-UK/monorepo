import type Stripe from "stripe";
import { describe, expect, it } from "vitest";
import { SessionRecordingStripeGateway } from "./session-recording-stripe-gateway.js";
import { createOrRenewCheckoutSession } from "./stripe-checkout-session-lifecycle.js";
import type {
  CreateCheckoutSessionInput,
  CreateCheckoutSessionResult,
  IStripePaymentGateway,
} from "./stripe-payment-gateway.js";

/** Stripe's idempotency rules: a key replays its first response, and refuses other parameters. */
class FakeStripe {
  readonly status = new Map<string, "open" | "expired">();
  private readonly byKey = new Map<
    string,
    { params: string; result: CreateCheckoutSessionResult }
  >();
  private seq = 0;

  async createCardCheckoutSession(
    input: CreateCheckoutSessionInput,
  ): Promise<CreateCheckoutSessionResult> {
    const { idempotencyKey, ...params } = input;
    const seen = this.byKey.get(idempotencyKey ?? "");
    if (seen) {
      if (seen.params !== JSON.stringify(params)) {
        throw Object.assign(new Error("same key, different parameters"), {
          type: "StripeIdempotencyError",
        });
      }
      return seen.result;
    }
    this.seq += 1;
    const result = {
      sessionId: `cs_${this.seq}`,
      url: `https://stripe/${this.seq}`,
      paymentIntentId: null,
    };
    this.status.set(result.sessionId, "open");
    this.byKey.set(idempotencyKey ?? "", { params: JSON.stringify(params), result });
    return result;
  }

  async expireCheckoutSession(id: string) {
    this.status.set(id, "expired");
  }

  async retrieveCheckoutSession(id: string) {
    return {
      id,
      status: this.status.get(id),
      url: "https://stripe/x",
      expires_at: Math.floor(Date.now() / 1000) + 3600,
    } as Stripe.Checkout.Session;
  }

  openSessions() {
    return [...this.status].filter(([, s]) => s === "open").map(([id]) => id);
  }
}

function setup() {
  const stripe = new FakeStripe();
  const recorded: string[] = [];
  const gateway = new SessionRecordingStripeGateway(stripe as unknown as IStripePaymentGateway, {
    record: async (_p, id) => {
      if (!recorded.includes(id)) recorded.push(id);
    },
    listSessionIds: async () => [...recorded],
  });
  const pay = (lines: string[]) =>
    createOrRenewCheckoutSession(gateway, "card", "pay-1", { lines }, (idempotencyKey) =>
      gateway.createCardCheckoutSession({
        paymentId: "pay-1",
        lines,
        idempotencyKey,
      } as unknown as CreateCheckoutSessionInput),
    );
  return { stripe, pay };
}

describe("repeated Pay on an invoice whose checkout changed", () => {
  it("six consecutive opens after a change all return a ready session", async () => {
    const { pay } = setup();
    await pay(["lot"]);
    for (let i = 0; i < 6; i += 1) {
      expect(await pay(["lot", "courier"])).toMatchObject({ kind: "ready" });
    }
  });

  it("unchanged parameters never close the buyer's open session", async () => {
    const { stripe, pay } = setup();
    const first = await pay(["lot"]);
    await pay(["lot"]);
    await pay(["lot"]);
    expect(stripe.openSessions()).toEqual([
      first.kind === "ready" ? first.session.sessionId : "none",
    ]);
  });

  it("after two changes only the newest session stays open", async () => {
    const { stripe, pay } = setup();
    await pay(["lot"]);
    await pay(["lot", "courier"]);
    const last = await pay(["lot", "courier", "framing"]);
    await pay(["lot", "courier", "framing"]);
    expect(stripe.openSessions()).toEqual([
      last.kind === "ready" ? last.session.sessionId : "none",
    ]);
  });
});
