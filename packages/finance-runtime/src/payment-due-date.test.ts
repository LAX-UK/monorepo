import { describe, expect, it } from "vitest";
import { formatPaymentDueDate } from "./payment-due-date.js";

describe("formatPaymentDueDate", () => {
  it("names the month in full", () => {
    expect(formatPaymentDueDate(new Date("2026-11-12T12:00:00Z"))).toBe("12 November 2026");
  });

  it("reads the London calendar day through summer time and the clock changes", () => {
    expect(formatPaymentDueDate(new Date("2026-06-30T23:30:00Z"))).toBe("1 July 2026");
    expect(formatPaymentDueDate(new Date("2026-03-29T00:30:00Z"))).toBe("29 March 2026");
    expect(formatPaymentDueDate(new Date("2026-10-24T23:30:00Z"))).toBe("25 October 2026");
    expect(formatPaymentDueDate(new Date("2026-10-25T23:30:00Z"))).toBe("25 October 2026");
  });
});
