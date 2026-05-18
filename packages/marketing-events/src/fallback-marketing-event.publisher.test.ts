import type { PublishOutcome, ResolvedMarketingEvent } from "@auction/types";
import { describe, expect, it, vi } from "vitest";
import { FallbackMarketingEventPublisher } from "./composite-marketing-event.publisher.js";
import { InMemoryCircuitBreaker } from "./inmemory-circuit-breaker.js";
import type { IMarketingEventPublisher } from "./interfaces/marketing-event-publisher.js";

const baseEvent = {
  name: "AddToWishlist",
  eventId: "evt-1",
  eventTime: 1_700_000_000,
  actionSource: "website",
  userIdOrAnon: { kind: "anon", anonId: "anon-1" },
  consent: { marketing: true, analytics: true, basis: "consent" },
  customData: { lotId: "lot-1" },
  userData: {},
} satisfies ResolvedMarketingEvent;

function publisherReturning(outcome: PublishOutcome): IMarketingEventPublisher {
  return { publish: vi.fn().mockResolvedValue(outcome) };
}

describe("FallbackMarketingEventPublisher", () => {
  it("prefers sGTM for website events when primary succeeds", async () => {
    const sgtm = publisherReturning({ status: "sent", vendor: "sgtm" });
    const capi = publisherReturning({ status: "sent", vendor: "meta_capi" });
    const pub = new FallbackMarketingEventPublisher(sgtm, capi, new InMemoryCircuitBreaker());
    const out = await pub.publish(baseEvent);
    expect(out).toEqual({ status: "sent", vendor: "sgtm" });
    expect(sgtm.publish).toHaveBeenCalledOnce();
    expect(capi.publish).not.toHaveBeenCalled();
  });

  it("falls back to CAPI when sGTM returns retryable failure", async () => {
    const sgtm = publisherReturning({
      status: "failed",
      error: "sgtm_down",
      retryable: true,
    });
    const capi = publisherReturning({ status: "sent", vendor: "meta_capi" });
    const pub = new FallbackMarketingEventPublisher(sgtm, capi, new InMemoryCircuitBreaker());
    const out = await pub.publish(baseEvent);
    expect(out).toEqual({ status: "sent", vendor: "meta_capi" });
    expect(capi.publish).toHaveBeenCalledOnce();
  });
});
