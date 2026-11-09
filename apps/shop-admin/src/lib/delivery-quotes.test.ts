import { describe, expect, it } from "vitest";
import {
  checkDeclineNote,
  checkQuoteForm,
  parseDeliveryQuoteView,
  quoteIssueMessages,
} from "./delivery-quotes";

const valid = { pricePence: 8500, carrier: " DHL Express ", service: "", leadTimeNote: "" };

describe("checkQuoteForm", () => {
  it("trims the words and leaves out the optional ones that are empty", () => {
    expect(checkQuoteForm(valid)).toEqual({
      ok: true,
      body: { pricePence: 8500, carrier: "DHL Express" },
    });
  });

  it("says each problem against its field", () => {
    expect(checkQuoteForm({ ...valid, pricePence: null, carrier: " " })).toEqual({
      ok: false,
      errors: {
        pricePence: "Enter the delivery price in pounds",
        carrier: "Enter the carrier",
      },
    });
  });

  it("refuses a price under a penny or over the limit", () => {
    expect(checkQuoteForm({ ...valid, pricePence: 0 })).toMatchObject({
      errors: { pricePence: "Enter a price of at least 1p" },
    });
    expect(checkQuoteForm({ ...valid, pricePence: 10_000_001 })).toMatchObject({
      errors: { pricePence: "Enter a price of £100,000 or less" },
    });
  });

  it("refuses words that are too long", () => {
    expect(checkQuoteForm({ ...valid, carrier: "x".repeat(121) })).toMatchObject({
      errors: { carrier: "Use 120 characters or fewer" },
    });
  });
});

describe("the rest", () => {
  it("needs a reason to turn a request down", () => {
    expect(checkDeclineNote(" ")).toBe("Tell the buyer why we can't deliver there");
    expect(checkDeclineNote("x".repeat(501))).toBe("Use 500 characters or fewer");
    expect(checkDeclineNote("Our couriers cannot collect there.")).toBeNull();
  });

  it("says the fields the server named", () => {
    expect(
      quoteIssueMessages([
        { field: "carrier", reason: "required" },
        { field: "note", reason: "required" },
      ]),
    ).toEqual({
      carrier: "Enter the carrier",
      note: "Tell the buyer why we can't deliver there",
    });
  });

  it("falls back to waiting for an unknown view", () => {
    expect(parseDeliveryQuoteView("quoted")).toBe("quoted");
    expect(parseDeliveryQuoteView("nonsense")).toBe("waiting");
    expect(parseDeliveryQuoteView(undefined)).toBe("waiting");
  });
});
