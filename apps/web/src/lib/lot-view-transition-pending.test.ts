import {
  consumePendingLotViewTransition,
  markPendingLotViewTransition,
} from "@/lib/lot-view-transition-pending";
import { afterEach, describe, expect, it } from "vitest";

describe("lot-view-transition-pending", () => {
  afterEach(() => {
    sessionStorage.clear();
  });

  it("marks and consumes a pending lot id once", () => {
    markPendingLotViewTransition("lot-1");
    expect(consumePendingLotViewTransition()).toBe("lot-1");
    expect(consumePendingLotViewTransition()).toBeNull();
  });
});
