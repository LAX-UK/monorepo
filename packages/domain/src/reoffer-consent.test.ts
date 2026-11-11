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
    ["given", "seller_agreed"],
    ["refused", "seller_declined"],
    ["lapsed", "seller_lapsed"],
  ] as const)("a %s answer moves the offer with %s", (answer, event) => {
    expect(answerConsent("requested", answer)).toEqual({
      ok: true,
      status: answer,
      reofferEvent: event,
    });
  });

  it.each(["given", "refused", "lapsed"] as const)(
    "cannot answer a consent already %s",
    (status) => {
      expect(answerConsent(status, "given")).toEqual({ ok: false, reason: "already_answered" });
    },
  );

  it("cannot answer a consent that was never needed", () => {
    expect(answerConsent("not_needed", "given")).toEqual({ ok: false, reason: "not_requested" });
  });
});
