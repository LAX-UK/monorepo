import type { ResolvedMarketingEvent } from "@auction/types";
import { describe, expect, it, vi } from "vitest";
import { MetaCapiMarketingEventPublisher } from "./meta-capi-marketing-event.publisher.js";

const baseEvent: ResolvedMarketingEvent = {
  name: "Purchase",
  eventId: "purchase-evt-1",
  eventTime: 1_700_000_000,
  actionSource: "website",
  userIdOrAnon: { kind: "user", userId: "user-1" },
  consent: { marketing: true, analytics: true, basis: "legitimate_interest" },
  customData: { valueMinor: 10_000, currencyCode: "GBP", lotId: "lot-1" },
  eventSourceUrl: "https://lax.bid/lot/foo",
  userData: {
    em: ["abc123"],
    fbp: "fb.1.123.456",
  },
};

describe("MetaCapiMarketingEventPublisher", () => {
  it("sends event_id, action_source, and test_event_code in payload", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ events_received: 1 }), { status: 200 }));
    const pub = new MetaCapiMarketingEventPublisher(
      "pixel-1",
      "token-1",
      "TEST123",
      "v21.0",
      fetchFn,
    );
    const out = await pub.publish(baseEvent);
    expect(out.status).toBe("sent");
    expect(fetchFn).toHaveBeenCalledOnce();
    const firstCall = fetchFn.mock.calls[0];
    expect(firstCall).toBeDefined();
    const [, init] = firstCall ?? [];
    const body = JSON.parse(String(init?.body)) as {
      test_event_code: string;
      data: Array<Record<string, unknown>>;
    };
    expect(body.test_event_code).toBe("TEST123");
    const firstEvent = body.data[0];
    expect(firstEvent).toMatchObject({
      event_name: "Purchase",
      event_id: "purchase-evt-1",
      action_source: "website",
      event_source_url: "https://lax.bid/lot/foo",
    });
    const userData = firstEvent?.user_data as Record<string, unknown>;
    expect(userData).toBeDefined();
    expect(userData.em).toEqual(["abc123"]);
    expect(userData.fbp).toBe("fb.1.123.456");
  });

  it("marks 5xx responses as retryable failures", async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response("error", { status: 503 }));
    const pub = new MetaCapiMarketingEventPublisher("p", "t", undefined, "v21.0", fetchFn);
    const out = await pub.publish(baseEvent);
    expect(out).toMatchObject({ status: "failed", retryable: true });
  });
});
