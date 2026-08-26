import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  markContextualKycReturnPending,
  trackContextualKycReturnIfPending,
} from "./contextual-kyc-return";

const trackContextualKycGate = vi.fn();

vi.mock("@/lib/analytics/events", () => ({
  trackContextualKycGate: (...args: unknown[]) => trackContextualKycGate(...args),
}));

describe("contextual KYC return tracking", () => {
  beforeEach(() => {
    trackContextualKycGate.mockReset();
    sessionStorage.clear();
  });

  it("emits contextual_kyc_returned when the user reaches the pending destination", () => {
    markContextualKycReturnPending({
      source: "bid_gate",
      nextPath: "/lot/foo/1",
    });

    trackContextualKycReturnIfPending("/lot/foo/1", true);

    expect(trackContextualKycGate).toHaveBeenCalledWith({
      event: "contextual_kyc_returned",
      source: "bid_gate",
    });
    expect(sessionStorage.getItem("lax_contextual_kyc_return")).toBeNull();
  });

  it("matches equivalent query-bearing destinations after normalization", () => {
    markContextualKycReturnPending({
      source: "condition_report",
      nextPath: "/lot/foo/1/?source=gate&tab=condition",
    });

    trackContextualKycReturnIfPending("/lot/foo/1?tab=condition&source=gate", true);

    expect(trackContextualKycGate).toHaveBeenCalledWith({
      event: "contextual_kyc_returned",
      source: "condition_report",
    });
  });

  it("does not emit before KYC is approved or when the path does not match", () => {
    markContextualKycReturnPending({
      source: "registration",
      nextPath: "/sales/example/live",
    });

    trackContextualKycReturnIfPending("/sales/example/live", false);
    trackContextualKycReturnIfPending("/dashboard", true);

    expect(trackContextualKycGate).not.toHaveBeenCalled();
  });
});
