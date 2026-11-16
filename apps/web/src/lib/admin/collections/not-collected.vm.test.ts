import { describe, expect, it } from "vitest";
import { OVERDUE_FOLLOW_UP, OVERDUE_LOT } from "./not-collected.fixture";
import {
  overdueRowView,
  parseExtensionDays,
  validateExtendDraft,
  validateWaiveReason,
} from "./not-collected.vm";

const NOW = new Date("2026-11-15T12:00:00Z");

describe("a lot past its collect-by day, as a row", () => {
  it("says how far over, the day and buyer, the storage so far and the band", () => {
    expect(overdueRowView(OVERDUE_LOT, NOW)).toMatchObject({
      lotLine: "Lot 12 · Lowland Storm",
      daysOver: "14 days over",
      collectBy: "Collect by Sun 1 Nov · Northfield Collection Ltd",
      band: "Standard",
      storage: "£42.00",
      storageDetail: "£42.00 so far (14 days at £3 a day), plus VAT where it applies.",
      followUp: false,
      extendBlocked: null,
      canWaive: true,
      extendedNote: null,
    });
  });

  it("flags 60 days for follow-up and blocks Extend once 30 days were given", () => {
    expect(overdueRowView(OVERDUE_FOLLOW_UP, NOW)).toMatchObject({
      daysOver: "66 days over",
      band: "Large",
      followUp: true,
      extendBlocked: "This lot has had the most free days it can: 30.",
      extendedNote: "Extended by 30 days",
    });
    expect(overdueRowView({ ...OVERDUE_LOT, daysOver: 1 }, NOW).daysOver).toBe("1 day over");
  });

  it("offers no waiver when waived, nothing is owed or the lot is under the legacy terms", () => {
    const waived = overdueRowView({ ...OVERDUE_LOT, waived: true, amountPence: 0 }, NOW);
    expect(waived).toMatchObject({
      storage: "Charges waived",
      storageDetail: null,
      canWaive: false,
    });
    const legacy = overdueRowView(
      { ...OVERDUE_LOT, legacyTerms: true, amountPence: 0, amountDetail: null },
      NOW,
    );
    expect(legacy).toMatchObject({
      storage: "Won before storage terms: nothing is charged.",
      canWaive: false,
    });
    const nothing = overdueRowView({ ...OVERDUE_LOT, amountPence: 0, amountDetail: null }, NOW);
    expect(nothing).toMatchObject({ storage: "Nothing owed", canWaive: false });
  });

  it("names a lot without a number by its title", () => {
    expect(overdueRowView({ ...OVERDUE_LOT, lotNumber: null }, NOW).lotLine).toBe("Lowland Storm");
  });

  it("shows pence always, through the domain formatter", () => {
    expect(overdueRowView({ ...OVERDUE_LOT, amountPence: 123_456 }, NOW).storage).toBe("£1,234.56");
    expect(overdueRowView({ ...OVERDUE_LOT, amountPence: 500 }, NOW).storage).toBe("£5.00");
  });
});

describe("the reason dialogs' checks", () => {
  it("takes whole days from 1 to what the lot has left", () => {
    expect(parseExtensionDays("7", 30)).toBe(7);
    expect(parseExtensionDays(" 30 ", 30)).toBe(30);
    expect(parseExtensionDays("31", 30)).toBeNull();
    expect(parseExtensionDays("10", 5)).toBeNull();
    expect(parseExtensionDays("0", 30)).toBeNull();
    expect(parseExtensionDays("2.5", 30)).toBeNull();
    expect(parseExtensionDays("", 30)).toBeNull();
  });

  it("names each field at fault in the extension", () => {
    expect(validateExtendDraft({ days: "", reason: " " }, 12)).toEqual({
      days: "Enter a whole number of days from 1 to 12",
      reason: "Enter a reason",
    });
    expect(validateExtendDraft({ days: "3", reason: "Buyer abroad" }, 12)).toEqual({});
  });

  it("asks a waiver for a reason of at most 500 characters", () => {
    expect(validateWaiveReason("")).toBe("Enter a reason");
    expect(validateWaiveReason("x".repeat(501))).toBe("Enter a reason of 500 characters or fewer");
    expect(validateWaiveReason("Damaged in our store")).toBeUndefined();
  });
});
