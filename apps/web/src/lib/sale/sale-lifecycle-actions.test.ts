import { describe, expect, it } from "vitest";
import { saleLifecycleActions } from "./sale-lifecycle-actions";

describe("saleLifecycleActions", () => {
  it("invites registration and following while a sale can still take bids", () => {
    for (const status of ["scheduled", "active"] as const) {
      expect(saleLifecycleActions(status)).toEqual({
        register: true,
        follow: true,
      });
    }
  });

  it("offers no register or notify action once the sale has ended", () => {
    for (const status of ["ended", "cancelled", "voided"] as const) {
      expect(saleLifecycleActions(status)).toEqual({
        register: false,
        follow: false,
      });
    }
  });
});
