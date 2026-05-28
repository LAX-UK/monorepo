import { describe, expect, it } from "vitest";
import {
  buildNotificationsHref,
  countNotificationsSheetFilters,
  hasNotificationsActiveFilters,
  parseNotificationsParams,
} from "./notifications/notifications-filters";

describe("notifications-filters", () => {
  it("parseNotificationsParams applies defaults", () => {
    expect(parseNotificationsParams({})).toEqual({ tab: "all", type: "" });
  });

  it("buildNotificationsHref toggles type off", () => {
    const current = parseNotificationsParams({ type: "outbid", tab: "unread" });
    expect(buildNotificationsHref(current, { type: null })).toBe(
      "/dashboard/notifications?tab=unread",
    );
  });

  it("hasNotificationsActiveFilters detects tab and type", () => {
    expect(hasNotificationsActiveFilters(parseNotificationsParams({ type: "lot_won" }))).toBe(true);
    expect(hasNotificationsActiveFilters(parseNotificationsParams({ tab: "unread" }))).toBe(true);
    expect(hasNotificationsActiveFilters(parseNotificationsParams({}))).toBe(false);
  });

  it("countNotificationsSheetFilters counts type", () => {
    expect(countNotificationsSheetFilters(parseNotificationsParams({ type: "payment_due" }))).toBe(
      1,
    );
    expect(countNotificationsSheetFilters(parseNotificationsParams({}))).toBe(0);
  });
});
