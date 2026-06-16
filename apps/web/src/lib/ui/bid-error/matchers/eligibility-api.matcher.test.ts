import { describe, expect, it } from "vitest";
import { mapBidError } from "../index";

describe("eligibility API bid error matchers", () => {
  it("maps sale_registration_required with sale link", () => {
    const r = mapBidError("Register and be approved", {
      code: "sale_registration_required",
      saleRegistrationPath: "/sales/foo/1",
    });
    expect(r.title).toBe("Registration required");
    expect(r.actionHref).toBe("/sales/foo/1");
  });

  it("maps bid_limit_exceeded", () => {
    const r = mapBidError("Bid exceeds your approved limit", {
      code: "bid_limit_exceeded",
    });
    expect(r.title).toBe("Bid limit exceeded");
  });

  it("maps bid_rate_limited_minute", () => {
    const r = mapBidError("Too many bids", { code: "bid_rate_limited_minute" });
    expect(r.severity).toBe("warning");
    expect(r.title).toBe("Slow down");
  });

  it("maps bidding_disabled", () => {
    const r = mapBidError("Bidding temporarily disabled", { code: "bidding_disabled" });
    expect(r.severity).toBe("info");
  });

  it("maps bid_in_flight", () => {
    const r = mapBidError("Bid still processing; retry shortly", { code: "bid_in_flight" });
    expect(r.title).toBe("Bid in progress");
    expect(r.severity).toBe("warning");
  });

  it("maps not_a_member_of_legal_entity to a resync warning", () => {
    const r = mapBidError("not_a_member_of_legal_entity", {
      code: "not_a_member_of_legal_entity",
    });
    expect(r.title).toBe("Bidding profile out of sync");
    expect(r.severity).toBe("warning");
    expect(r.message).toContain("personal profile");
  });
});
