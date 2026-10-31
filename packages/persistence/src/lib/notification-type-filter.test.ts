import { describe, expect, it } from "vitest";
import { notificationTypesForFilter } from "./notification-type-filter.js";

describe("notificationTypesForFilter", () => {
  it("covers every delivery notice, the courier quote included", () => {
    expect(notificationTypesForFilter("fulfilment")).toEqual([
      "lot_ready_for_collection",
      "lot_shipped",
      "lot_delivered",
      "delivery_quote_ready",
    ]);
  });

  it("treats any other value as a single type", () => {
    expect(notificationTypesForFilter("lot_won")).toEqual(["lot_won"]);
    expect(notificationTypesForFilter("outbid")).toEqual(["outbid", "bid_refused_limit"]);
  });
});
