import { describe, expect, it } from "vitest";
import { paymentLinkAccess } from "./payment-link-access";

describe("paymentLinkAccess", () => {
  it("offers no lot or client links to someone who holds only finance", () => {
    expect(paymentLinkAccess("staff", ["finance"])).toEqual({
      canOpenLot: false,
      canOpenClient: false,
    });
  });

  it("offers both to an administrator", () => {
    expect(paymentLinkAccess("staff", ["administrator"])).toEqual({
      canOpenLot: true,
      canOpenClient: true,
    });
  });

  it("opens the lot page for finance combined with a role that can edit the catalogue", () => {
    expect(paymentLinkAccess("staff", ["finance", "cataloguer"]).canOpenLot).toBe(true);
  });

  it("offers nothing to a client", () => {
    expect(paymentLinkAccess("client", undefined)).toEqual({
      canOpenLot: false,
      canOpenClient: false,
    });
  });
});
