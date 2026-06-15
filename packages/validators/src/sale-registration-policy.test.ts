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

  it("memberEligibleForStaffInRoomCheckIn", () => {
    expect(memberEligibleForStaffInRoomCheckIn("owner", "individual")).toBe(true);
    expect(memberEligibleForStaffInRoomCheckIn("owner", "organisation")).toBe(false);
    expect(memberEligibleForStaffInRoomCheckIn("buyer_agent", "organisation")).toBe(true);
    expect(memberEligibleForStaffInRoomCheckIn("buyer_agent", "individual")).toBe(false);
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
