import { describe, expect, it } from "vitest";
import { calendarDayParam, listHref, oneOf, singleParam } from "./list-url-state";

describe("singleParam", () => {
  it("takes the first value and trims it", () => {
    expect(singleParam("  a ")).toBe("a");
    expect(singleParam(["x", "y"])).toBe("x");
  });

  it("treats blank and missing as absent", () => {
    expect(singleParam("   ")).toBeUndefined();
    expect(singleParam([])).toBeUndefined();
    expect(singleParam(undefined)).toBeUndefined();
  });
});

describe("oneOf", () => {
  it("only lets listed values through", () => {
    expect(oneOf("paid", ["paid", "refunded"] as const)).toBe("paid");
    expect(oneOf("PAID", ["paid"] as const)).toBeUndefined();
    expect(oneOf(undefined, ["paid"] as const)).toBeUndefined();
  });
});

describe("calendarDayParam", () => {
  it("accepts only YYYY-MM-DD", () => {
    expect(calendarDayParam("2026-03-01")).toBe("2026-03-01");
    expect(calendarDayParam("01/03/2026")).toBeUndefined();
    expect(calendarDayParam("2026-03-01T00:00")).toBeUndefined();
    expect(calendarDayParam(undefined)).toBeUndefined();
  });
});

describe("listHref", () => {
  it("omits empty parameters and the question mark when nothing is left", () => {
    expect(listHref("/orders", { status: undefined, q: "" })).toBe("/orders");
    expect(listHref("/orders", { status: "paid", q: "a b" })).toBe("/orders?status=paid&q=a+b");
  });
});
