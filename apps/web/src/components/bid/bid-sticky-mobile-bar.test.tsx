import type { BidBlockerAction } from "@/lib/bid/bid-blocker-presentation";
import { saleRegistrationPolicy } from "@/lib/bid/policies/sale-registration.policy";
import type { BidPolicyContext } from "@/lib/bid/policies/types";
import type { BidPolicyDecision } from "@/lib/bid/policies/types";
import { resolveRuntimeBidBlocker } from "@/lib/bid/resolve-runtime-bid-blocker";
import type { Lot } from "@auction/types";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { BidStickyMobileBar } from "./bid-sticky-mobile-bar";

function blocked(action: BidBlockerAction, viewId = "test-blocker"): BidPolicyDecision {
  return {
    kind: "block",
    viewId,
    presentation: {
      tone: "warning",
      title: "Bidding needs attention",
      detail: "Resolve this step before bidding.",
      action,
    },
    render: () => null,
  };
}

function registrationBlocked(
  status: "required" | "pending" | "rejected",
): Extract<BidPolicyDecision, { kind: "block" }> {
  const context: BidPolicyContext = {
    user: { id: "buyer-1", email: "buyer@example.com", name: "Buyer", role: "client" },
    lot: { id: "lot-1", sellerId: "seller-1" } as Lot,
    lotStatus: "active",
    loginNextPath: "/lot/example/lot-1",
    saleRegistrationBidGate: {
      saleId: "sale-1",
      requiresRegistration: true,
      actingEntityId: "entity-1",
      registrationStatus: status,
      approvedBidLimit: null,
      buyerEntities: [{ id: "entity-1", displayName: "Agency", memberRole: "buyer_agent" }],
      myRegistrations: [],
      kycApproved: true,
    },
  };
  const decision = saleRegistrationPolicy.evaluate(context);
  if (decision.kind !== "block") throw new Error(`Expected ${status} registration to block`);
  return decision;
}

function runtimeBlocked(
  unsupportedAuctionMode: boolean,
  connectionBlocked: boolean,
): Extract<BidPolicyDecision, { kind: "block" }> {
  const decision = resolveRuntimeBidBlocker({
    policyDecision: { kind: "allow" },
    unsupportedAuctionMode,
    connectionBlocked,
    connectionState: connectionBlocked ? "offline" : "live",
  });
  if (decision.kind !== "block") throw new Error("Expected runtime state to block");
  return decision;
}

const baseProps: ComponentProps<typeof BidStickyMobileBar> = {
  live: true,
  decision: { kind: "allow" },
  loginNextPath: "/lot/example/lot-1",
  step: 1,
  currentPriceLabel: "£100",
  priceFlash: false,
  onScrollToBid: vi.fn(),
  remainingLabel: "1 minute",
  msRemaining: 60_000,
  timerState: { kind: "live", msLeft: 60_000 },
  countdownClock: "00:01:00",
  lifecycleKind: "live",
  compact: true,
};

describe("BidStickyMobileBar blockers", () => {
  it("uses the shared link action metadata", () => {
    render(
      <BidStickyMobileBar
        {...baseProps}
        decision={blocked(
          {
            kind: "link",
            href: "/onboarding/identity",
            label: "Continue verification",
            shortLabel: "Continue",
          },
          "strict-kyc-required",
        )}
      />,
    );

    expect(screen.getByText("Bidding needs attention")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Continue" })).toHaveAttribute(
      "href",
      "/onboarding/identity",
    );
  });

  it("renders email recovery as a real button", () => {
    render(
      <BidStickyMobileBar
        {...baseProps}
        decision={blocked({
          kind: "email",
          email: "buyer@example.com",
          next: "/lot/example/lot-1",
          label: "Send verification email",
          shortLabel: "Verify email",
        })}
      />,
    );

    expect(screen.getByRole("button", { name: "Verify email" })).toBeEnabled();
  });

  it("renders in-review blockers as status text instead of a fake CTA", () => {
    render(
      <BidStickyMobileBar
        {...baseProps}
        decision={blocked({
          kind: "status",
          label: "In review",
        })}
      />,
    );

    expect(screen.getByText("In review")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "In review" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "In review" })).not.toBeInTheDocument();
  });

  it("opens an inline registration panel from panel actions", () => {
    const onScrollToBid = vi.fn();
    render(
      <BidStickyMobileBar
        {...baseProps}
        onScrollToBid={onScrollToBid}
        decision={registrationBlocked("required")}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Register" }));
    expect(onScrollToBid).toHaveBeenCalledOnce();
  });

  it("links to a dedicated registration path when available", () => {
    render(
      <BidStickyMobileBar
        {...baseProps}
        saleRegistrationPath="/sales/sale-1/register"
        decision={registrationBlocked("rejected")}
      />,
    );

    expect(screen.getByRole("link", { name: "Update" })).toHaveAttribute(
      "href",
      "/sales/sale-1/register",
    );
  });

  it("renders an actual pending registration as status-only", () => {
    render(<BidStickyMobileBar {...baseProps} decision={registrationBlocked("pending")} />);

    expect(screen.getByText("Pending")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Pending" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Pending" })).not.toBeInTheDocument();
  });

  it("renders an actual connectivity blocker as status-only", () => {
    render(<BidStickyMobileBar {...baseProps} decision={runtimeBlocked(false, true)} />);

    expect(screen.getByText("Offline")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Offline" })).not.toBeInTheDocument();
  });

  it("renders an actual unsupported-mode recovery link", () => {
    render(<BidStickyMobileBar {...baseProps} decision={runtimeBlocked(true, false)} />);

    expect(screen.getByRole("link", { name: "Contact" })).toHaveAttribute("href", "/contact");
  });
});
