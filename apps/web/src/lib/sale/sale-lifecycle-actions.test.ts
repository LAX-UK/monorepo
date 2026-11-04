import { describe, expect, it } from "vitest";
import { saleLifecycleActions } from "./sale-lifecycle-actions";

describe("saleLifecycleActions", () => {
  it("invites registration and following before a sale opens", () => {
    expect(saleLifecycleActions("scheduled")).toEqual({ register: true, follow: true });
  });

  it("keeps registration but drops following once the sale is live", () => {
    expect(saleLifecycleActions("active")).toEqual({ register: true, follow: false });
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
