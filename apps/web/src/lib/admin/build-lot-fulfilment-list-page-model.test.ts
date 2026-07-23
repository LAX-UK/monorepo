import { buildLotFulfilmentListPageModel } from "@/lib/admin/build-lot-fulfilment-list-page-model";
import { describe, expect, it } from "vitest";

describe("buildLotFulfilmentListPageModel", () => {
  it("preserves filters and selected lot drawer param", () => {
    const model = buildLotFulfilmentListPageModel({
      status: "awaiting_release",
      q: "vase",
      offset: "25",
      limit: "50",
      lot: "lot-123",
    });

    expect(model.listQueryParams).toEqual({
      limit: 50,
      offset: 25,
      status: "awaiting_release",
      q: "vase",
    });
    expect(model.selectedLotId).toBe("lot-123");
    expect(model.buildDrawerHref("lot-456")).toContain("lot=lot-456");
    expect(model.buildDrawerHref(null)).not.toContain("lot=");
  });
});
