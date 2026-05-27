import { describe, expect, it } from "vitest";

import { DEFAULT_AUCTION_ZONE } from "./constants.js";
import {
  formatDatetimeDisplayHuman,
  fromDatetimeFormString,
  toCalendarDate,
  toDatetimeFormString,
  toTimeFormString,
} from "./format.js";

describe("datetime adapter", () => {
  it("round-trips datetime form string in London zone", () => {
    const raw = "2026-06-15T14:30";
    const { instant, zone } = fromDatetimeFormString(raw, DEFAULT_AUCTION_ZONE);
    expect(zone).toBe(DEFAULT_AUCTION_ZONE);
    expect(toDatetimeFormString(instant, DEFAULT_AUCTION_ZONE)).toBe(raw);
  });

  it("formats time as HH:mm in London zone", () => {
    const { instant } = fromDatetimeFormString("2026-01-10T09:05", DEFAULT_AUCTION_ZONE);
    expect(toTimeFormString(instant, DEFAULT_AUCTION_ZONE)).toBe("09:05");
  });

  it("produces calendar date from instant", () => {
    const { instant } = fromDatetimeFormString("2026-03-20T23:45", DEFAULT_AUCTION_ZONE);
    const cal = toCalendarDate(instant, DEFAULT_AUCTION_ZONE);
    expect(cal.getFullYear()).toBe(2026);
    expect(cal.getMonth()).toBe(2);
    expect(cal.getDate()).toBe(20);
  });

  it("formats human-readable display label", () => {
    expect(formatDatetimeDisplayHuman("2026-06-15T14:30", DEFAULT_AUCTION_ZONE)).toMatch(
      /Jun 2026.*2:30 PM/i,
    );
  });
});
