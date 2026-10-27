import { describe, expect, it } from "vitest";
import {
  memberEligibleForStaffInRoomCheckIn,
  memberRequiresWebSaleRegistration,
  saleAllowsInRoomCheckIn,
  shouldEnforceRegistrationBidLimit,
} from "./sale-registration-policy.js";

describe("sale-registration-policy", () => {
  it("memberRequiresWebSaleRegistration is buyer_agent only", () => {
    expect(memberRequiresWebSaleRegistration("buyer_agent")).toBe(true);
    expect(memberRequiresWebSaleRegistration("owner")).toBe(false);
    expect(memberRequiresWebSaleRegistration(null)).toBe(false);
  });

  it.each(["owner", "admin", "buyer_agent"] as const)("lists %s for in-room check-in", (role) => {
    expect(memberEligibleForStaffInRoomCheckIn(role)).toBe(true);
  });

  it.each(["finance", "consignor", "viewer", "specialist", "staff"] as const)(
    "never lists %s for in-room check-in",
    (role) => {
      expect(memberEligibleForStaffInRoomCheckIn(role)).toBe(false);
    },
  );

  it("never lists a missing role", () => {
    expect(memberEligibleForStaffInRoomCheckIn(null)).toBe(false);
  });

  it("saleAllowsInRoomCheckIn for saleroom modes", () => {
    expect(saleAllowsInRoomCheckIn("hybrid")).toBe(true);
    expect(saleAllowsInRoomCheckIn("onsite")).toBe(true);
    expect(saleAllowsInRoomCheckIn("online")).toBe(false);
  });

  it("shouldEnforceRegistrationBidLimit when approved reg exists", () => {
    expect(shouldEnforceRegistrationBidLimit(true)).toBe(true);
    expect(shouldEnforceRegistrationBidLimit(false)).toBe(false);
  });
});
