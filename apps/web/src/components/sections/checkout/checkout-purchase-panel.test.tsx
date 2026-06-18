import { CheckoutPurchasePanel } from "@/components/sections/checkout/checkout-purchase-panel";
import type { SessionUser } from "@/lib/data/contracts";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

vi.mock("@/lib/actions/checkout", () => ({
  createCheckoutPaymentAction: vi.fn(),
}));

vi.mock("@/lib/analytics/events", () => ({
  trackBeginCheckout: vi.fn(),
}));

vi.mock("@/lib/shell/shell-chrome-context", () => ({
  HideBottomTabBarWhileMounted: () => null,
}));

const user = { id: "user-1", role: "client" } as SessionUser;

describe("CheckoutPurchasePanel", () => {
  it("hides inline submit below lg when mobile chrome owns the CTA", () => {
    render(
      <CheckoutPurchasePanel
        sessionUser={user}
        lotId="00000000-0000-4000-8000-000000000001"
        lotTitle="Blue Canvas Study"
        hammer="£100"
        buyerPremium="£25"
        total="£125"
        premiumPercentLabel="25%"
        addresses={[
          {
            id: "00000000-0000-4000-8000-0000000000a1",
            label: "Home",
            line1: "1 Test St",
            line2: null,
            city: "London",
            state: null,
            postalCode: "SW1A 1AA",
            country: "United Kingdom",
            addressType: "both",
            isDefault: true,
          },
        ]}
      />,
    );

    const submits = screen.getAllByRole("button", { name: /complete purchase/i });
    const desktopSubmit = submits.find((el) => el.className.includes("lg:flex"));
    expect(desktopSubmit?.className).toMatch(/\bhidden\b/);
    expect(desktopSubmit?.className).toMatch(/\blg:flex\b/);
  });

  it("shows compliance block for pending payment with AML reason", () => {
    render(
      <CheckoutPurchasePanel
        sessionUser={user}
        lotId="00000000-0000-4000-8000-000000000001"
        lotTitle="Blue Canvas Study"
        hammer="£100"
        buyerPremium="£25"
        total="£125"
        premiumPercentLabel="25%"
        addresses={[]}
        openPaymentStatus="pending"
        openPaymentManualReviewReason="aml_hold"
      />,
    );
    expect(screen.getByText("Compliance review")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /complete purchase/i })).not.toBeInTheDocument();
  });

  it("shows AML manual review block without purchase form", () => {
    render(
      <CheckoutPurchasePanel
        sessionUser={user}
        lotId="00000000-0000-4000-8000-000000000001"
        lotTitle="Blue Canvas Study"
        hammer="£100"
        buyerPremium="£25"
        total="£125"
        premiumPercentLabel="25%"
        addresses={[]}
        openPaymentStatus="requires_manual_review"
        openPaymentManualReviewReason="aml_hold"
      />,
    );
    expect(screen.getByText("Compliance review")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /complete purchase/i })).not.toBeInTheDocument();
  });

  it("shows finance release block when manual review has no specific reason", () => {
    render(
      <CheckoutPurchasePanel
        sessionUser={user}
        lotId="00000000-0000-4000-8000-000000000001"
        lotTitle="Blue Canvas Study"
        hammer="£100"
        buyerPremium="£25"
        total="£125"
        premiumPercentLabel="25%"
        addresses={[]}
        openPaymentStatus="requires_manual_review"
        openPaymentManualReviewReason={null}
      />,
    );
    expect(screen.getByText("Finance review")).toBeInTheDocument();
    expect(screen.getByText(/settlements for release/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /complete purchase/i })).not.toBeInTheDocument();
  });

  it("shows payment complete state without purchase form", () => {
    render(
      <CheckoutPurchasePanel
        sessionUser={user}
        lotId="00000000-0000-4000-8000-000000000001"
        lotTitle="Blue Canvas Study"
        hammer="£100"
        buyerPremium="£25"
        total="£125"
        premiumPercentLabel="25%"
        addresses={[]}
        paymentComplete
      />,
    );
    expect(screen.getByText(/payment recorded/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /complete purchase/i })).not.toBeInTheDocument();
  });

  it("shows bank transfer in-flight block without purchase form", () => {
    render(
      <CheckoutPurchasePanel
        sessionUser={user}
        lotId="00000000-0000-4000-8000-000000000001"
        lotTitle="Blue Canvas Study"
        hammer="£100"
        buyerPremium="£25"
        total="£125"
        premiumPercentLabel="25%"
        addresses={[]}
        openPaymentStatus="authorized"
      />,
    );
    expect(screen.getByText(/bank transfer processing/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /complete purchase/i })).not.toBeInTheDocument();
  });

  it("shows confirming payment block after Stripe success return without purchase form", () => {
    render(
      <CheckoutPurchasePanel
        sessionUser={user}
        lotId="00000000-0000-4000-8000-000000000001"
        lotTitle="Blue Canvas Study"
        hammer="£100"
        buyerPremium="£25"
        total="£125"
        premiumPercentLabel="25%"
        addresses={[
          {
            id: "00000000-0000-4000-8000-0000000000a1",
            label: "Home",
            line1: "1 Test St",
            line2: null,
            city: "London",
            state: null,
            postalCode: "SW1A 1AA",
            country: "United Kingdom",
            addressType: "both",
            isDefault: true,
          },
        ]}
        openPaymentStatus="pending"
        stripeReturnSuccess
      />,
    );
    expect(screen.getByText(/confirming payment/i)).toBeInTheDocument();
    expect(screen.getByText(/please do not pay again/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /complete purchase/i })).not.toBeInTheDocument();
  });

  it("shows bank transfer instructions (not 'do not pay again') for a bank transfer return", () => {
    render(
      <CheckoutPurchasePanel
        sessionUser={user}
        lotId="00000000-0000-4000-8000-000000000001"
        lotTitle="Blue Canvas Study"
        hammer="£100"
        buyerPremium="£25"
        total="£125"
        premiumPercentLabel="25%"
        addresses={[
          {
            id: "00000000-0000-4000-8000-0000000000a1",
            label: "Home",
            line1: "1 Test St",
            line2: null,
            city: "London",
            state: null,
            postalCode: "SW1A 1AA",
            country: "United Kingdom",
            addressType: "both",
            isDefault: true,
          },
        ]}
        openPaymentStatus="pending"
        openPaymentCheckoutRail="gb_bank_transfer"
        stripeReturnSuccess
      />,
    );
    expect(screen.getByText(/send your transfer to complete payment/i)).toBeInTheDocument();
    expect(screen.queryByText(/please do not pay again/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /complete purchase/i })).not.toBeInTheDocument();
  });

  it("blocks checkout when payments history failed to load", () => {
    render(
      <CheckoutPurchasePanel
        sessionUser={user}
        lotId="00000000-0000-4000-8000-000000000001"
        lotTitle="Blue Canvas Study"
        hammer="£100"
        buyerPremium="£25"
        total="£125"
        premiumPercentLabel="25%"
        addresses={[]}
        paymentsLoadFailed
      />,
    );
    expect(
      screen.getByText(/could not confirm whether this lot is already paid/i),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /complete purchase/i })).not.toBeInTheDocument();
  });
});
