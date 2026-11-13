import type Stripe from "stripe";
import { describe, expect, it, vi } from "vitest";
import type { IStripeClientFactory } from "../../lib/stripe-client.js";
import {
  checkRefundEventSubscription,
  logRefundEventSubscription,
} from "./stripe-refund-event-subscription-check.js";

type Endpoint = Pick<Stripe.WebhookEndpoint, "id" | "url" | "status" | "enabled_events">;

function factory(endpoints: Endpoint[] | Error | null): IStripeClientFactory {
  if (endpoints === null) return { get: () => null, require: () => ({}) as never };
  const list = vi.fn(() => {
    if (endpoints instanceof Error) {
      return {
        // biome-ignore lint/correctness/useYield: throws before yielding, as a refused key does
        async *[Symbol.asyncIterator]() {
          throw endpoints;
        },
      };
    }
    return {
      async *[Symbol.asyncIterator]() {
        yield* endpoints;
      },
    };
  });
  const stripe = { webhookEndpoints: { list } } as unknown as Stripe;
  return { get: () => stripe, require: () => stripe };
}

const endpoint = (over: Partial<Endpoint>): Endpoint => ({
  id: "we_1",
  url: "https://api.example.test/webhooks/stripe/payments",
  status: "enabled",
  enabled_events: ["charge.refunded"],
  ...over,
});

describe("the startup check for charge.refund.updated", () => {
  it("reports the payments endpoint missing the event, and only warns", async () => {
    const log = { info: vi.fn(), warn: vi.fn() };
    const result = await logRefundEventSubscription(
      factory([
        endpoint({}),
        endpoint({ id: "we_t", url: "https://api.example.test/webhooks/stripe/transfers" }),
      ]),
      log,
    );
    expect(result).toEqual({ status: "missing", endpointIds: ["we_1"] });
    expect(log.warn).toHaveBeenCalledWith(
      expect.stringContaining("stripe_webhook_missing_charge_refund_updated"),
    );
  });

  it("is satisfied by the event itself or by every event", async () => {
    expect(
      await checkRefundEventSubscription(
        factory([endpoint({ enabled_events: ["charge.refunded", "charge.refund.updated"] })]),
      ),
    ).toEqual({ status: "subscribed", endpointIds: ["we_1"] });
    expect(
      await checkRefundEventSubscription(
        factory([
          endpoint({ url: "https://x.test/webhooks/stripe/payments/", enabled_events: ["*"] }),
        ]),
      ),
    ).toEqual({ status: "subscribed", endpointIds: ["we_1"] });
  });

  it("ignores disabled endpoints and says when none matches", async () => {
    expect(await checkRefundEventSubscription(factory([endpoint({ status: "disabled" })]))).toEqual(
      { status: "no_matching_endpoint" },
    );
  });

  it("never fails when the key may not read endpoints, or Stripe is not set up", async () => {
    const log = { info: vi.fn(), warn: vi.fn() };
    await expect(
      logRefundEventSubscription(factory(new Error("restricted key")), log),
    ).resolves.toEqual({ status: "unreadable", error: "restricted key" });
    expect(log.info).toHaveBeenCalledWith(
      expect.stringContaining("stripe_webhook_subscription_unreadable"),
    );
    expect(log.warn).not.toHaveBeenCalled();
    await expect(checkRefundEventSubscription(factory(null))).resolves.toEqual({
      status: "not_configured",
    });
  });
});
