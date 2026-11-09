import { describe, expect, it } from "vitest";
import { deliveryQuoteStartResult, quoteIssueErrors } from "./delivery-quote-request";
import { countryName, holdUntilLabel, outsideUkCountryOptions } from "./outside-uk";

describe("deliveryQuoteStartResult", () => {
  it("reads each answer a request can get", () => {
    expect(
      deliveryQuoteStartResult(200, {
        outcome: "quote_requested",
        orderReference: "LAX-S-10482",
        holdUntil: "2026-11-16T12:00:00.000Z",
        regionId: "eu",
        country: "DE",
      }),
    ).toEqual({
      kind: "quote_requested",
      orderReference: "LAX-S-10482",
      holdUntil: "2026-11-16T12:00:00.000Z",
      country: "DE",
      regionId: "eu",
    });
    expect(
      deliveryQuoteStartResult(200, { outcome: "pay_now", checkoutUrl: "https://pay.test/x" }),
    ).toEqual({ kind: "pay", checkoutUrl: "https://pay.test/x" });
    expect(deliveryQuoteStartResult(200, { outcome: "not_delivered", country: "RU" })).toEqual({
      kind: "not_delivered",
      country: "RU",
    });
  });

  it("does not trust an answer it does not recognise", () => {
    expect(deliveryQuoteStartResult(200, { outcome: "mystery" }).kind).toBe("error");
    expect(deliveryQuoteStartResult(200, null).kind).toBe("error");
  });

  it("says address problems against each field", () => {
    const result = deliveryQuoteStartResult(400, {
      code: "shop.validation",
      issues: [
        { field: "phone", reason: "invalid_phone" },
        { field: "country", reason: "united_kingdom" },
      ],
    });
    expect(result).toEqual({
      kind: "fields",
      errors: {
        phone: "Enter a phone number with the country code, like +49 30 1234567",
        country: "Choose UK insured delivery for an address in the United Kingdom",
      },
    });
    expect(quoteIssueErrors("nonsense")).toEqual({});
  });

  it("sends a known email to sign in", () => {
    expect(deliveryQuoteStartResult(409, { code: "shop.account_exists" })).toEqual({
      kind: "sign_in_required",
    });
  });

  it("shows the server's own wording for too many open requests, as written", () => {
    expect(
      deliveryQuoteStartResult(409, {
        code: "shop.conflict",
        message: "You already have delivery quote requests waiting.",
      }),
    ).toEqual({ kind: "error", message: "You already have delivery quote requests waiting." });
  });

  it("falls back to plain words for anything else", () => {
    expect(deliveryQuoteStartResult(500, {}).kind).toBe("error");
    expect(deliveryQuoteStartResult(429, {})).toEqual({
      kind: "error",
      message: "Too many attempts. Wait a few minutes and try again.",
    });
  });
});

describe("outside the UK, in words", () => {
  it("names countries, never codes", () => {
    expect(countryName("de")).toBe("Germany");
  });

  it("lists countries by name without the UK, starting from a prompt", () => {
    const options = outsideUkCountryOptions();
    expect(options[0]).toEqual({ value: "", label: "Choose a country" });
    expect(options.some((option) => option.value === "GB")).toBe(false);
    expect(options.find((option) => option.value === "DE")?.label).toBe("Germany");
    // Restricted countries stay listed, so choosing one explains instead of vanishing.
    expect(options.some((option) => option.value === "RU")).toBe(true);
    const labels = options.slice(1).map((option) => option.label);
    expect([...labels].sort((a, b) => a.localeCompare(b, "en-GB"))).toEqual(labels);
  });

  it("words a date the one way", () => {
    expect(holdUntilLabel("2026-11-16T12:00:00.000Z")).toBe("16 November 2026");
  });
});
