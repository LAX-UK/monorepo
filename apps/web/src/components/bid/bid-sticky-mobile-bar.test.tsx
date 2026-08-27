import { emailVerificationBidBlockerPresentation } from "@/lib/bid/presenters/email-verification-blocker.presenter";
import { resolveKycBidBlockerPresentation } from "@/lib/bid/presenters/kyc-blocker.presenter";
import { contextualIdentityOnboardingHref } from "@/lib/kyc/identity-onboarding";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
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
          presentation: emailVerificationBidBlockerPresentation(
            "buyer@example.com",
            "/lot/example/lot-1",
          ),
        }}
      />,
    );

    expect(screen.getByRole("button", { name: "Verify email" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /review bid|confirm bid|increase bid/i }),
    ).toBeNull();
  });

  it.each([false, true])("links strict KYC to the contextual lot flow (compact=%s)", (compact) => {
    const href = contextualIdentityOnboardingHref("/lot/example/lot-1", "bid_gate", "lot-1");
    render(
      <BidStickyMobileBar
        {...baseProps}
        compact={compact}
        decision={{
          kind: "block",
          viewId: "strict-kyc-required",
          presentation: resolveKycBidBlockerPresentation({ href, strict: true }),
        }}
      />,
    );

    expect(screen.getByRole("link")).toHaveAttribute("href", href);
    expect(
      screen.queryByRole("button", { name: /review bid|confirm bid|increase bid/i }),
    ).toBeNull();
  });
});

describe("BidStickyMobileBar sale registration", () => {
  it("scrolls to the pending registration notice from the compact bar", () => {
    const onScrollToBid = vi.fn();
    render(
      <BidStickyMobileBar
        {...baseProps}
        compact
        onScrollToBid={onScrollToBid}
        decision={{
          kind: "block",
          viewId: "sale-registration-pending",
          presentation: {
            tone: "info",
            title: "Registration pending",
            detail: "Awaiting approval.",
            action: { kind: "panel", label: "View status", shortLabel: "View status" },
            preview: "After approval, you can bid.",
          },
        }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "View status" }));
    expect(onScrollToBid).toHaveBeenCalled();
  });
});
