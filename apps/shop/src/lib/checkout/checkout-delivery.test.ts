import { describe, expect, it } from "vitest";
import {
  addWorkingDays,
  checkoutDeliverySummaryRow,
  londonToday,
  parseWorkingDayWindow,
  presentCheckoutDeliveryOptions,
} from "./checkout-delivery";

describe("parseWorkingDayWindow", () => {
  it.each([
    ["3-5", { min: 3, max: 5 }],
    [" 2 ", { min: 2, max: 2 }],
    ["1 - 5", { min: 1, max: 5 }],
  ])("reads %s", (raw, expected) => {
    expect(parseWorkingDayWindow(raw)).toEqual(expected);
  });

  it.each([undefined, "", "soon", "5-3", "0", "2-10"])("treats %s as not configured", (raw) => {
    expect(parseWorkingDayWindow(raw)).toBeNull();
  });
});

describe("working days", () => {
  it("skips weekends", () => {
    // Friday 30 October 2026 + 1 working day is Monday 2 November.
    expect(addWorkingDays(new Date(Date.UTC(2026, 9, 30)), 1).toISOString()).toBe(
      "2026-11-02T00:00:00.000Z",
    );
  });

  it("uses the London date, not the server's", () => {
    // 23:30 UTC on 31 March 2026 is already 1 April in London (BST).
    expect(londonToday(new Date("2026-03-31T23:30:00Z")).toISOString()).toBe(
      "2026-04-01T00:00:00.000Z",
    );
  });
});

describe("presentCheckoutDeliveryOptions", () => {
  const monday = new Date("2026-10-26T10:00:00Z");

  it("names each option in plain words, with prices and configured dates", () => {
    const options = presentCheckoutDeliveryOptions({
      now: monday,
      times: { ukDelivery: { min: 3, max: 5 }, collection: { min: 2, max: 2 } },
    });
    expect(
      options.map((option) => [option.value, option.label, option.price, option.timing]),
    ).toEqual([
      ["uk_insured_delivery", "UK insured delivery", "£15.00", "Arrives Thu 29 Oct – Mon 2 Nov"],
      ["collect_new_cavendish", "Collect from our London gallery", "Free", "Ready from Wed 28 Oct"],
      ["international_quotation", "Delivery outside the UK", null, null],
    ]);
    const text = JSON.stringify(options);
    for (const internal of ["surcharge", "LAX storage", "Brunswick"]) {
      expect(text).not.toContain(internal);
    }
  });

  it("promises no time when none is configured", () => {
    const options = presentCheckoutDeliveryOptions({
      now: monday,
      times: { ukDelivery: null, collection: null },
    });
    expect(options.every((option) => option.timing === null)).toBe(true);
    expect(options[0]?.description).toBe("Packed and insured to your door");
  });
});

describe("checkoutDeliverySummaryRow", () => {
  it("prices delivery and collection as checkout charges them", () => {
    expect(checkoutDeliverySummaryRow("uk_insured_delivery")).toEqual({
      label: "UK insured delivery",
      value: "£15.00",
      pence: 1500,
    });
    expect(checkoutDeliverySummaryRow("collect_new_cavendish")).toMatchObject({
      label: "Collection in London",
      value: "Free",
      pence: 0,
    });
    expect(checkoutDeliverySummaryRow("international_quotation").pence).toBe(0);
  });
});
