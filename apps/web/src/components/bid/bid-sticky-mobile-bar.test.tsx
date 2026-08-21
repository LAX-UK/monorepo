import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BidStickyMobileBar } from "./bid-sticky-mobile-bar";

const baseProps = {
  live: true,
  loginNextPath: "/lot/example/lot-1",
  lotId: "lot-1",
  step: 1 as const,
  currentPriceLabel: "£100.00",
  priceFlash: false,
  onScrollToBid: () => {},
  remainingLabel: "1 hour",
  msRemaining: 3_600_000,
  timerState: { kind: "live" as const, msLeft: 3_600_000 },
  countdownClock: "01:00:00",
};

describe("BidStickyMobileBar strict eligibility", () => {
  it.each([false, true])("replaces bid actions with email verification (compact=%s)", (compact) => {
    render(
      <BidStickyMobileBar
        {...baseProps}
        compact={compact}
        userEmail="buyer@example.com"
        decision={{
          kind: "block",
          viewId: "email-verification-required",
          render: () => null,
        }}
      />,
    );

    expect(screen.getByRole("button", { name: "Verify email" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /review bid|confirm bid|increase bid/i }),
    ).toBeNull();
  });

  it.each([false, true])("links strict KYC to the contextual lot flow (compact=%s)", (compact) => {
    render(
      <BidStickyMobileBar
        {...baseProps}
        compact={compact}
        decision={{ kind: "block", viewId: "strict-kyc-required", render: () => null }}
      />,
    );

    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      "/onboarding/identity?next=%2Flot%2Fexample%2Flot-1&source=bid_gate&lot=lot-1",
    );
    expect(
      screen.queryByRole("button", { name: /review bid|confirm bid|increase bid/i }),
    ).toBeNull();
  });
});
