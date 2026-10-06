import { describe, expect, it } from "vitest";
import { resolvePortalPayoutStatusPresentation } from "./portal-payout-status.presenter.js";

describe("portal payout status presenter", () => {
  it("maps known statuses", () => {
    expect(resolvePortalPayoutStatusPresentation("pending_refund_period").label).toBe(
      "In cancellation period",
    );
    expect(resolvePortalPayoutStatusPresentation("due").label).toBe("Due");
    expect(resolvePortalPayoutStatusPresentation("paid").label).toBe("Paid");
    expect(resolvePortalPayoutStatusPresentation("cancelled").label).toBe("Cancelled");
  });
});
