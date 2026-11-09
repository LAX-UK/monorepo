import { describe, expect, it } from "vitest";
import {
  DELIVERY_QUOTES_WRITE_CAPABILITY,
  QUOTE_PRICE_MAX_PENCE,
  declineNoteIssue,
  deliveryQuoteInputIssues,
} from "./delivery-quote-staff.js";
import { capabilitiesForRole } from "./staff-capabilities.js";

const good = { pricePence: 8500, carrier: "DHL Express" };

describe("deliveryQuoteInputIssues", () => {
  it("accepts a price in whole pence and a carrier, with optional words", () => {
    expect(deliveryQuoteInputIssues(good)).toEqual([]);
    expect(
      deliveryQuoteInputIssues({
        ...good,
        service: "Express insured",
        leadTimeNote: "5 to 7 days",
      }),
    ).toEqual([]);
  });

  it("refuses a price that is not a positive whole number of pence, or is absurd", () => {
    expect(deliveryQuoteInputIssues({ ...good, pricePence: 85.5 })).toEqual([
      { field: "pricePence", reason: "not_whole_pence" },
    ]);
    expect(deliveryQuoteInputIssues({ ...good, pricePence: 0 })).toEqual([
      { field: "pricePence", reason: "below_one_penny" },
    ]);
    expect(deliveryQuoteInputIssues({ ...good, pricePence: QUOTE_PRICE_MAX_PENCE + 1 })).toEqual([
      { field: "pricePence", reason: "too_high" },
    ]);
  });

  it("needs a carrier, and bounds every free-text field", () => {
    expect(deliveryQuoteInputIssues({ ...good, carrier: "  " })).toEqual([
      { field: "carrier", reason: "required" },
    ]);
    expect(
      deliveryQuoteInputIssues({
        ...good,
        carrier: "c".repeat(121),
        service: "s".repeat(121),
        leadTimeNote: "n".repeat(301),
      }).map((issue) => issue.field),
    ).toEqual(["carrier", "service", "leadTimeNote"]);
  });
});

describe("declineNoteIssue", () => {
  it("asks for a reason the buyer can be given", () => {
    expect(declineNoteIssue("  ")).toBe("required");
    expect(declineNoteIssue("x".repeat(501))).toBe("too_long");
    expect(declineNoteIssue("Our couriers cannot collect from that region.")).toBeNull();
  });
});

describe("who may quote", () => {
  it("is order.write, held by the people who run orders", () => {
    expect(DELIVERY_QUOTES_WRITE_CAPABILITY).toBe("order.write");
    expect(capabilitiesForRole("operations")).toContain("order.write");
    expect(capabilitiesForRole("finance")).not.toContain("order.write");
  });
});
