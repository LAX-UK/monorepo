import { describe, expect, it } from "vitest";
import {
  NOTIFICATION_TYPE_OPTIONS,
  buildNotificationsHref,
  getNotificationsActiveFilters,
  parseNotificationsParams,
} from "./notifications-filters";

describe("notifications type filter", () => {
  it("offers delivery notices as one option", () => {
    expect(NOTIFICATION_TYPE_OPTIONS).toContainEqual({ id: "fulfilment", label: "Delivery" });
  });

  it("round-trips the delivery filter through the address", () => {
    const href = buildNotificationsHref(parseNotificationsParams({}), { type: "fulfilment" });
    expect(href).toBe("/notifications?type=fulfilment");
    expect(parseNotificationsParams({ type: "fulfilment" }).type).toBe("fulfilment");
  });

  it("labels the active delivery filter", () => {
    const active = getNotificationsActiveFilters(parseNotificationsParams({ type: "fulfilment" }));
    expect(active.map((a) => a.label)).toEqual(["Delivery"]);
  });
});
