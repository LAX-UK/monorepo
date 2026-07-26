import type { ResolvedMarketingEvent } from "@auction/types";
import { describe, expect, it, vi } from "vitest";
import { SgtmMarketingEventPublisher } from "./sgtm-marketing-event.publisher.js";

describe("SgtmMarketingEventPublisher attribution", () => {
  it("sends namespaced first/last parameters without reserved campaign fields", async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    const event: ResolvedMarketingEvent = {
      name: "Lead",
      eventId: "lead-1",
      eventTime: 1_700_000_000,
      actionSource: "website",
      userIdOrAnon: { kind: "user", userId: "user-1" },
      consent: { marketing: true, analytics: true, basis: "consent" },
      customData: { method: "email" },
      userData: {},
      clientContext: {
        gaClientId: "1234567890.9876543210",
        gaSessionId: "1700000000",
      },
      attribution: {
        version: 1,
        firstTouch: {
          capturedAt: "2026-01-01T00:00:00.000Z",
          landingPath: "/first",
          utmSource: "newsletter",
        },
        lastTouch: {
          capturedAt: "2026-01-02T00:00:00.000Z",
          landingPath: "/last",
          utmCampaign: "spring",
          gclid: "click-1",
          fbclid: "meta-only",
        },
      },
    };

    await new SgtmMarketingEventPublisher(
      "https://gtm.example",
      "G-TEST",
      undefined,
      fetchFn,
    ).publish(event);

    const body = new URLSearchParams(String(fetchFn.mock.calls[0]?.[1]?.body));
    expect(body.get("ep.attribution_first_source")).toBe("newsletter");
    expect(body.get("ep.attribution_last_campaign")).toBe("spring");
    expect(body.get("ep.attribution_last_gclid")).toBe("click-1");
    expect(body.has("ep.attribution_last_fbclid")).toBe(false);
    expect(body.has("utm_campaign")).toBe(false);
    expect(body.get("cid")).toBe("1234567890.9876543210");
    expect(body.get("sid")).toBe("1700000000");
    expect(body.get("_et")).toBe("1");
    expect(body.has("ep.ga_session_id")).toBe(false);
  });
});
