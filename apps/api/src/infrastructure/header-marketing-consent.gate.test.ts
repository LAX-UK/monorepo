import type { MarketingEvent } from "@auction/types";
import { describe, expect, it } from "vitest";
import { EventMarketingConsentGate } from "./header-marketing-consent.gate.js";

const base: MarketingEvent = {
  name: "AddToWishlist",
  eventId: "e1",
  eventTime: 1,
  actionSource: "website",
  userIdOrAnon: { kind: "user", userId: "u1" },
  consent: { marketing: false, analytics: false, basis: "consent" },
  customData: { lotId: "l1" },
};

describe("EventMarketingConsentGate", () => {
  const gate = new EventMarketingConsentGate();

  it("denies when marketing consent is false", () => {
    expect(gate.isAllowed(base)).toBe(false);
  });

  it("allows when marketing consent is granted", () => {
    expect(
      gate.isAllowed({
        ...base,
        consent: { marketing: true, analytics: true, basis: "consent" },
      }),
    ).toBe(true);
  });

  it("allows Purchase under legitimate interest without marketing consent", () => {
    expect(
      gate.isAllowed({
        ...base,
        name: "Purchase",
        consent: { marketing: false, analytics: false, basis: "legitimate_interest" },
        customData: { lotId: "l1", valueMinor: 100, currencyCode: "GBP" },
      }),
    ).toBe(true);
  });
});
