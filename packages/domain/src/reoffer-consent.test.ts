import { describe, expect, it } from "vitest";
import { answerConsent, consentRequirement, initialReofferStatus } from "./reoffer-consent.js";

describe("consentRequirement", () => {
  it("always asks the seller, per offer, for a seller's lot", () => {
    const result = consentRequirement({
      ownership: "seller",
      offerMinor: 9_000_00,
      reserveMinor: null,
    });
    expect(result).toEqual({
      status: "requested",
      reason: "seller_consent_required",
      hasReserve: false,
      belowReserve: false,
    });
  });

  it("asks even when the offer meets the reserve", () => {
    const result = consentRequirement({
      ownership: "seller",
      offerMinor: 5_000_00,
      reserveMinor: 5_000_00,
    });
    expect(result.status).toBe("requested");
    expect(result).toMatchObject({ hasReserve: true, belowReserve: false });
  });

  it("flags an offer below the reserve", () => {
    const result = consentRequirement({
      ownership: "seller",
      offerMinor: 4_999_99,
      reserveMinor: 5_000_00,
    });
    expect(result).toMatchObject({ status: "requested", hasReserve: true, belowReserve: true });
  });

  it("needs no consent for LAX-owned stock, and still carries the reserve", () => {
    const result = consentRequirement({
      ownership: "lax_owned",
      offerMinor: 100,
      reserveMinor: 500,
    });
    expect(result).toEqual({
      status: "not_needed",
      reason: "lax_owned_no_consent_needed",
      hasReserve: true,
      belowReserve: true,
    });
  });

  it("reads a zero reserve as none", () => {
    expect(
      consentRequirement({ ownership: "seller", offerMinor: 1, reserveMinor: 0 }),
    ).toMatchObject({ hasReserve: false, belowReserve: false });
  });
});

describe("initialReofferStatus", () => {
  it("waits for the seller, or is ready when no consent is needed", () => {
    const asked = consentRequirement({ ownership: "seller", offerMinor: 1, reserveMinor: null });
    const exempt = consentRequirement({
      ownership: "lax_owned",
      offerMinor: 1,
      reserveMinor: null,
    });
    expect(initialReofferStatus(asked)).toBe("awaiting_seller");
    expect(initialReofferStatus(exempt)).toBe("ready");
  });
});

describe("answerConsent", () => {
  it.each([
    ["given", "seller", "seller_agreed"],
    ["refused", "seller", "seller_declined"],
    ["given", "staff", "seller_agreed"],
    ["refused", "staff", "seller_declined"],
    ["lapsed", "clock", "seller_lapsed"],
  ] as const)(
    "a requested consent answered %s by %s moves the offer with %s",
    (answer, channel, event) => {
      expect(answerConsent("requested", answer, channel)).toEqual({
        ok: true,
        status: answer,
        reofferEvent: event,
      });
    },
  );

  it("lets only the clock lapse a request, and never takes the clock for an answer", () => {
    expect(answerConsent("requested", "lapsed", "seller")).toEqual({
      ok: false,
      reason: "not_allowed",
    });
    expect(answerConsent("requested", "lapsed", "staff")).toEqual({
      ok: false,
      reason: "not_allowed",
    });
    expect(answerConsent("requested", "given", "clock")).toEqual({
      ok: false,
      reason: "not_allowed",
    });
  });

  it.each([
    ["given", "seller_agreed"],
    ["refused", "seller_declined"],
  ] as const)("lets staff record a %s answer after the request lapsed", (answer, event) => {
    expect(answerConsent("lapsed", answer, "staff")).toEqual({
      ok: true,
      status: answer,
      reofferEvent: event,
    });
  });

  it("keeps a lapsed request closed to the seller and the clock", () => {
    expect(answerConsent("lapsed", "given", "seller")).toEqual({
      ok: false,
      reason: "already_answered",
    });
    expect(answerConsent("lapsed", "lapsed", "clock")).toEqual({
      ok: false,
      reason: "already_answered",
    });
    expect(answerConsent("lapsed", "lapsed", "staff")).toEqual({
      ok: false,
      reason: "not_allowed",
    });
  });

  it.each(["given", "refused"] as const)("cannot answer a consent already %s", (status) => {
    for (const channel of ["seller", "staff", "clock"] as const) {
      expect(answerConsent(status, "given", channel)).toEqual({
        ok: false,
        reason: "already_answered",
      });
    }
  });

  it("cannot answer a consent that was never needed", () => {
    expect(answerConsent("not_needed", "given", "staff")).toEqual({
      ok: false,
      reason: "not_requested",
    });
  });
});
