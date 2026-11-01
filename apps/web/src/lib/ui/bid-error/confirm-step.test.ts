import { describe, expect, it } from "vitest";
import { shouldStayOnBidConfirmStep } from "./confirm-step";

describe("shouldStayOnBidConfirmStep", () => {
  it("keeps confirm step for rate limits and min bid", () => {
    expect(shouldStayOnBidConfirmStep("bid_rate_limited_minute", "Too many bids")).toBe(true);
    expect(shouldStayOnBidConfirmStep(null, "Bid must be at least £110.00")).toBe(true);
    expect(shouldStayOnBidConfirmStep("bid_in_flight", "Bid still processing")).toBe(true);
  });

  it("keeps the confirm step when the amount can be corrected", () => {
    expect(shouldStayOnBidConfirmStep("over_limit", "Bid exceeds")).toBe(true);
    expect(shouldStayOnBidConfirmStep("amount_invalid", "Bid must be")).toBe(true);
    expect(shouldStayOnBidConfirmStep("outbid_during_confirm", "Bid must be")).toBe(true);
  });

  it("returns to step 1 for hard blocks", () => {
    expect(shouldStayOnBidConfirmStep("sale_registration_required", "Register")).toBe(false);
    expect(shouldStayOnBidConfirmStep("kyc_required", "kyc_required")).toBe(false);
  });
});
