import type { IAttributionStore } from "@auction/marketing-events";
import type { MarketingAttributionSnapshot } from "@auction/types";
import { describe, expect, it, vi } from "vitest";
import {
  buildEnrichedWebsiteUserEvent,
  resolveAttributionForWebsiteEvent,
} from "./marketing-attribution-context.js";
import type { WebsiteEventContext } from "./marketing-event-factory.js";

const storedFirst = {
  capturedAt: "2026-01-01T00:00:00.000Z",
  landingPath: "/first",
  utmSource: "newsletter",
};
const headerLast = {
  capturedAt: "2026-01-02T00:00:00.000Z",
  landingPath: "/last",
  utmSource: "paid",
};

function context(input?: {
  attribution?: MarketingAttributionSnapshot;
  marketing?: boolean;
}): WebsiteEventContext {
  return {
    get: ((key: string) => {
      if (key === "marketingConsentMarketing") return input?.marketing ?? true;
      if (key === "marketingConsentAnalytics") return true;
      return undefined;
    }) as WebsiteEventContext["get"],
    req: {
      header: (name) =>
        name === "x-lax-attribution" && input?.attribution
          ? JSON.stringify(input.attribution)
          : undefined,
    },
  };
}

function store(get: IAttributionStore["get"]): IAttributionStore {
  return { get, put: vi.fn(), delete: vi.fn() };
}

describe("marketing attribution event context", () => {
  it("treats the stored snapshot as authoritative", async () => {
    const stored: MarketingAttributionSnapshot = { version: 1, firstTouch: storedFirst };
    const incoming: MarketingAttributionSnapshot = { version: 1, lastTouch: headerLast };

    await expect(
      resolveAttributionForWebsiteEvent({
        context: context({ attribution: incoming }),
        consent: { marketing: true, analytics: true, basis: "consent" },
        userId: "user-1",
        attributionStore: store(vi.fn().mockResolvedValue(stored)),
      }),
    ).resolves.toEqual(stored);
  });

  it("does not read attribution without marketing consent", async () => {
    const get = vi.fn();
    await expect(
      resolveAttributionForWebsiteEvent({
        context: context({ marketing: false }),
        consent: { marketing: false, analytics: true, basis: "consent" },
        userId: "user-1",
        attributionStore: store(get),
      }),
    ).resolves.toBeUndefined();
    expect(get).not.toHaveBeenCalled();
  });

  it("does not trust a request snapshot when the store has no record", async () => {
    const incoming: MarketingAttributionSnapshot = { version: 1, lastTouch: headerLast };
    await expect(
      resolveAttributionForWebsiteEvent({
        context: context({ attribution: incoming }),
        consent: { marketing: true, analytics: true, basis: "consent" },
        userId: "user-1",
        attributionStore: store(vi.fn().mockResolvedValue(null)),
      }),
    ).resolves.toBeUndefined();
  });

  it("drops the client snapshot when the authoritative store is unavailable", async () => {
    const incoming: MarketingAttributionSnapshot = { version: 1, lastTouch: headerLast };
    await expect(
      resolveAttributionForWebsiteEvent({
        context: context({ attribution: incoming }),
        consent: { marketing: true, analytics: true, basis: "consent" },
        userId: "user-1",
        attributionStore: store(vi.fn().mockRejectedValue(new Error("database unavailable"))),
      }),
    ).resolves.toBeUndefined();
  });

  it("never enriches when the runtime flag is disabled", async () => {
    const get = vi.fn();
    const event = await buildEnrichedWebsiteUserEvent(
      context(),
      {
        name: "Lead",
        eventId: "event-1",
        userId: "user-1",
        customData: { method: "email" },
      },
      { attributionEnabled: false, attributionStore: store(get) },
    );
    expect(event.attribution).toBeUndefined();
    expect(get).not.toHaveBeenCalled();
  });
});
