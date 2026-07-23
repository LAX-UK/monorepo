import { paymentStatuses, payoutStatuses } from "@auction/types";
import { describe, expect, it } from "vitest";
import { getPaymentStatusView, getPayoutStatusView } from "./payment-status";

describe("getPayoutStatusView", () => {
  it("returns a view for every payout status", () => {
    for (const status of payoutStatuses) {
      const view = getPayoutStatusView(status);
      expect(view.label.length).toBeGreaterThan(0);
      expect(view.badgeClassName.length).toBeGreaterThan(0);
      expect(["success", "danger", "info", "neutral"]).toContain(view.tone);
    }
  });

  it("maps success-tone for paid", () => {
    expect(getPayoutStatusView("paid").tone).toBe("success");
  });

  it("maps danger-tone for failed/reversed/clawback_pending", () => {
    expect(getPayoutStatusView("failed").tone).toBe("danger");
    expect(getPayoutStatusView("reversed").tone).toBe("danger");
    expect(getPayoutStatusView("clawback_pending").tone).toBe("danger");
  });

  it("maps info-tone for in_transit", () => {
    expect(getPayoutStatusView("in_transit").tone).toBe("info");
  });

  it("maps neutral-tone for scheduled", () => {
    expect(getPayoutStatusView("scheduled").tone).toBe("neutral");
  });
});

describe("getPaymentStatusView", () => {
  it("returns a view for every payment status", () => {
    for (const status of paymentStatuses) {
      const view = getPaymentStatusView(status);
      expect(view.label.length).toBeGreaterThan(0);
      expect(view.badgeClassName.length).toBeGreaterThan(0);
    }
  });

  it("maps captured to success tone", () => {
    expect(getPaymentStatusView("captured").tone).toBe("success");
  });

  it("maps refunded to neutral tone", () => {
    expect(getPaymentStatusView("refunded").tone).toBe("neutral");
  });

  it("maps pending to info tone", () => {
    expect(getPaymentStatusView("pending").tone).toBe("info");
  });

  it("maps authorized and requires_manual_review to info tone", () => {
    expect(getPaymentStatusView("authorized").tone).toBe("info");
    expect(getPaymentStatusView("authorized").label).toBe("Awaiting bank transfer confirmation");
    expect(getPaymentStatusView("requires_manual_review").tone).toBe("info");
  });
});
