import { describe, expect, it } from "vitest";
import { notificationTypesForFilter } from "./notification-type-filter.js";

describe("notificationTypesForFilter", () => {
  it("covers all three fulfilment notices", () => {
    expect(notificationTypesForFilter("fulfilment")).toEqual([
      "lot_ready_for_collection",
      "lot_shipped",
      "lot_delivered",
    ]);
  });

  it("treats any other value as a single type", () => {
    expect(notificationTypesForFilter("outbid")).toEqual(["outbid"]);
  });
});
