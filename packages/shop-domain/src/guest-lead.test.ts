import { describe, expect, it } from "vitest";
import {
  GUEST_LEAD_SOURCE_LABEL,
  guestLeadSourceForEnquiry,
  guestLeadStatus,
} from "./guest-lead.js";

describe("guest lead rules", () => {
  it("ranks a lead by the furthest step it reached", () => {
    const at = new Date("2026-10-30T12:00:00Z");
    expect(guestLeadStatus({ paidOrderCount: 0, checkoutStartedAt: null })).toBe("enquired");
    expect(guestLeadStatus({ paidOrderCount: 0, checkoutStartedAt: at })).toBe(
      "abandoned_checkout",
    );
    expect(guestLeadStatus({ paidOrderCount: 2, checkoutStartedAt: at })).toBe("ordered");
  });

  it("names the storefront an enquiry lead came from", () => {
    expect(GUEST_LEAD_SOURCE_LABEL[guestLeadSourceForEnquiry("art")]).toBe("lax.art enquiry");
    expect(GUEST_LEAD_SOURCE_LABEL[guestLeadSourceForEnquiry("shop")]).toBe("Shop enquiry");
  });
});
