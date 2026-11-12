import { describe, expect, it } from "vitest";
import { offerReminderAt, offerStep, sellerRequestStep } from "./reoffer-sweep.js";

const at = (iso: string) => new Date(iso);

describe("sellerRequestStep", () => {
  // Asked Mon 2 Nov 2026 10:00 London (GMT): reminder Wed 4 Nov 17:00, due Thu 5 Nov 17:00.
  const base = {
    offerStatus: "awaiting_seller" as const,
    consentStatus: "requested",
    requestedAt: at("2026-11-02T10:00:00Z"),
    dueAt: at("2026-11-05T17:00:00Z"),
    remindedAt: null,
  };

  it("waits before the reminder time", () => {
    expect(sellerRequestStep(base, at("2026-11-04T16:59:59Z"))).toBe("none");
  });

  it("reminds from the reminder time, once", () => {
    expect(sellerRequestStep(base, at("2026-11-04T17:00:00Z"))).toBe("remind");
    const reminded = { ...base, remindedAt: at("2026-11-04T17:05:00Z") };
    expect(sellerRequestStep(reminded, at("2026-11-05T09:00:00Z"))).toBe("none");
  });

  it("lapses at the deadline, even if the reminder never went", () => {
    expect(sellerRequestStep(base, at("2026-11-05T17:00:00Z"))).toBe("lapse");
    expect(sellerRequestStep(base, at("2026-11-09T09:00:00Z"))).toBe("lapse");
  });

  it("lapses a reminded request as well", () => {
    const reminded = { ...base, remindedAt: at("2026-11-04T17:05:00Z") };
    expect(sellerRequestStep(reminded, at("2026-11-05T17:00:01Z"))).toBe("lapse");
  });

  it("leaves a request that has been answered or moved on alone", () => {
    const late = at("2026-11-20T09:00:00Z");
    expect(sellerRequestStep({ ...base, consentStatus: "given" }, late)).toBe("none");
    expect(sellerRequestStep({ ...base, consentStatus: "lapsed" }, late)).toBe("none");
    expect(sellerRequestStep({ ...base, offerStatus: "withdrawn" }, late)).toBe("none");
    expect(sellerRequestStep({ ...base, offerStatus: "ready" }, late)).toBe("none");
  });

  it("never touches a request without a deadline", () => {
    expect(sellerRequestStep({ ...base, dueAt: null }, at("2026-12-01T00:00:00Z"))).toBe("none");
  });
});

describe("offerStep", () => {
  // Sent Mon 2 Nov 10:00, three days: ends Thu 5 Nov 17:00; reminder Wed 4 Nov 17:00.
  const offer = {
    status: "offered" as const,
    offerSentAt: at("2026-11-02T10:00:00Z"),
    offerEndsAt: at("2026-11-05T17:00:00Z"),
  };

  it("is quiet until a day before the end", () => {
    expect(offerStep(offer, at("2026-11-04T16:59:59Z"))).toBe("none");
  });

  it("reminds in the last day and ends at the end time", () => {
    expect(offerStep(offer, at("2026-11-04T17:00:00Z"))).toBe("remind");
    expect(offerStep(offer, at("2026-11-05T16:59:59Z"))).toBe("remind");
    expect(offerStep(offer, at("2026-11-05T17:00:00Z"))).toBe("end");
    expect(offerStep(offer, at("2026-11-09T00:00:00Z"))).toBe("end");
  });

  it("only acts on an offer that is out", () => {
    for (const status of ["ready", "accepted", "declined", "expired", "withdrawn"] as const) {
      expect(offerStep({ ...offer, status }, at("2026-11-09T00:00:00Z"))).toBe("none");
    }
  });

  it("does not remind an offer shorter than a day, but still ends it", () => {
    const short = {
      status: "offered" as const,
      offerSentAt: at("2026-11-02T16:00:00Z"),
      offerEndsAt: at("2026-11-03T09:00:00Z"),
    };
    expect(offerReminderAt(short)).toBeNull();
    expect(offerStep(short, at("2026-11-03T08:00:00Z"))).toBe("none");
    expect(offerStep(short, at("2026-11-03T09:00:00Z"))).toBe("end");
  });

  it("has no reminder before it was sent", () => {
    expect(offerReminderAt({ offerSentAt: null, offerEndsAt: offer.offerEndsAt })).toBeNull();
  });
});
