import { describe, expect, it } from "vitest";
import { BOOKED_UNPAID, QUOTED, deliveryFixture } from "./deliveries.fixture";
import {
  QUOTE_NOTE_MAX_LENGTH,
  checkQuoteForm,
  quoteActionFor,
  quoteDrift,
  quoteExpectation,
  quoteFormValues,
  quoteRequestBody,
} from "./delivery-quote-form";

describe("quoteActionFor (D5)", () => {
  it("offers Send quote while the buyer waits and Change quote once one is sent", () => {
    expect(quoteActionFor(deliveryFixture())).toBe("send");
    expect(quoteActionFor(QUOTED)).toBe("change");
  });

  it("offers nothing once the buyer accepted or the request closed", () => {
    expect(quoteActionFor(BOOKED_UNPAID)).toBeNull();
    expect(
      quoteActionFor(deliveryFixture({ quote: { ...QUOTED.quote, status: "withdrawn" } })),
    ).toBeNull();
  });
});

describe("quoteFormValues", () => {
  it("opens empty to send, and pre-filled with the price and note to change", () => {
    expect(quoteFormValues(deliveryFixture())).toEqual({ pence: null, parse: "empty", note: "" });
    expect(quoteFormValues(QUOTED)).toEqual({
      pence: 18_000,
      parse: null,
      note: "Insured, two-person delivery",
    });
  });
});

describe("checkQuoteForm", () => {
  it("asks for an amount above zero when the price is empty or zero, in the route's words", () => {
    expect(checkQuoteForm({ pence: null, parse: "empty", note: "" })).toEqual({
      price: "Enter an amount above zero",
    });
    expect(checkQuoteForm({ pence: 0, parse: null, note: "" })).toEqual({
      price: "Enter an amount above zero",
    });
  });

  it("asks for pounds when the text is not an amount, or has more than two decimals", () => {
    const words = "Enter an amount in pounds, like 240 or 240.50";
    expect(checkQuoteForm({ pence: null, parse: "invalid", note: "" }).price).toBe(words);
    expect(checkQuoteForm({ pence: null, parse: "too_precise", note: "" }).price).toBe(words);
    // Above what the route reads (12 whole digits).
    expect(checkQuoteForm({ pence: 100_000_000_000_000, parse: null, note: "" }).price).toBe(words);
  });

  it("keeps the note to the route's 500 characters, after trimming", () => {
    const long = "x".repeat(QUOTE_NOTE_MAX_LENGTH + 1);
    expect(checkQuoteForm({ pence: 18_000, parse: null, note: long })).toEqual({
      note: "Keep the note to 500 characters or fewer",
    });
    expect(checkQuoteForm({ pence: 18_000, parse: null, note: ` ${"x".repeat(500)} ` })).toEqual(
      {},
    );
  });

  it("finds both fields when both fail", () => {
    expect(
      Object.keys(checkQuoteForm({ pence: null, parse: "empty", note: "x".repeat(501) })),
    ).toEqual(["price", "note"]);
  });
});

describe("quoteRequestBody", () => {
  it("sends pounds as a plain decimal from whole pence, with no commas or float drift", () => {
    expect(quoteRequestBody({ pence: 18_000, note: "" })).toEqual({ amount: "180.00", note: null });
    expect(quoteRequestBody({ pence: 123_456_789, note: "  Two-person  " })).toEqual({
      amount: "1234567.89",
      note: "Two-person",
    });
    expect(quoteRequestBody({ pence: 1, note: "" }).amount).toBe("0.01");
    // 0.1 + 0.2 in pounds, as pence, never 30.000000000000004.
    expect(quoteRequestBody({ pence: 30, note: "" }).amount).toBe("0.30");
  });
});

describe("quoteDrift", () => {
  const expected = quoteExpectation(deliveryFixture());

  it("sees nothing when the delivery is as the dialog showed it", () => {
    expect(expected).toEqual({ status: "requested", quotedAt: null });
    expect(quoteDrift(expected as never, deliveryFixture())).toBe("none");
    expect(quoteDrift(quoteExpectation(QUOTED) as never, QUOTED)).toBe("none");
  });

  it("says another person quoted it, while it is still open to staff", () => {
    expect(quoteDrift(expected as never, QUOTED)).toBe("already_quoted");
    const requoted = deliveryFixture({
      quote: { ...QUOTED.quote, quotedAt: "2026-11-16T11:00:00.000Z", amountMinor: 20_000 },
    });
    expect(quoteDrift(quoteExpectation(QUOTED) as never, requoted)).toBe("already_quoted");
  });

  it("says it changed when the buyer accepted or withdrew, or it is gone", () => {
    expect(quoteDrift(expected as never, BOOKED_UNPAID)).toBe("changed");
    expect(
      quoteDrift(
        expected as never,
        deliveryFixture({ quote: { ...deliveryFixture().quote, status: "withdrawn" } }),
      ),
    ).toBe("changed");
    expect(quoteDrift(expected as never, null)).toBe("changed");
  });

  it("has no expectation for a delivery staff cannot price", () => {
    expect(quoteExpectation(BOOKED_UNPAID)).toBeNull();
  });
});
