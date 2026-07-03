import { CheckoutPurchasePanel } from "@/components/sections/checkout/checkout-purchase-panel";
import type { SessionUser } from "@/lib/data/contracts";
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ComponentProps } from "react";
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

const defaultAddress = {
  id: "00000000-0000-4000-8000-0000000000a1",
  label: "Home",
  line1: "1 Test St",
  line2: null,
  city: "London",
  state: null,
  postalCode: "SW1A 1AA",
  country: "United Kingdom",
  addressType: "both" as const,
  isDefault: true,
};

const secondAddress = {
  id: "00000000-0000-4000-8000-0000000000a2",
  label: "Studio",
  line1: "2 Art Rd",
  line2: null,
  city: "London",
  state: null,
  postalCode: "E1 1AA",
  country: "United Kingdom",
  addressType: "both" as const,
  isDefault: false,
};

function baseProps(overrides: Partial<ComponentProps<typeof CheckoutPurchasePanel>> = {}) {
  return {
    sessionUser: user,
    lotId: "00000000-0000-4000-8000-000000000001",
    lotTitle: "Blue Canvas Study",
    hammer: "£100",
    buyerPremium: "£25",
    total: "£125",
    premiumPercentLabel: "25%",
    addresses: [defaultAddress],
    ...overrides,
  };
}

describe("CheckoutPurchasePanel", () => {
  it("hides inline submit below lg when mobile chrome owns the CTA", () => {
    render(<CheckoutPurchasePanel {...baseProps()} />);

    const submits = screen.getAllByRole("button", { name: /complete purchase/i });
    const desktopSubmit = submits.find((el) => el.className.includes("lg:flex"));
    expect(desktopSubmit?.className).toMatch(/\bhidden\b/);
    expect(desktopSubmit?.className).toMatch(/\blg:flex\b/);
  });

  it("shows compliance block for pending payment with AML reason", () => {
    render(
      <CheckoutPurchasePanel
        {...baseProps({
          addresses: [],
          openPaymentStatus: "pending",
          openPaymentManualReviewReason: "aml_hold",
        })}
      />,
    );
    expect(screen.getByText("Compliance review")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /complete purchase/i })).not.toBeInTheDocument();
  });

  it("shows AML manual review block without purchase form", () => {
    render(
      <CheckoutPurchasePanel
        {...baseProps({
          addresses: [],
          openPaymentStatus: "requires_manual_review",
          openPaymentManualReviewReason: "aml_hold",
        })}
      />,
    );
    expect(screen.getByText("Compliance review")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /complete purchase/i })).not.toBeInTheDocument();
  });

  it("shows finance release block when manual review has no specific reason", () => {
    render(
      <CheckoutPurchasePanel
        {...baseProps({
          addresses: [],
          openPaymentStatus: "requires_manual_review",
          openPaymentManualReviewReason: null,
        })}
      />,
    );
    expect(screen.getByText("Finance review")).toBeInTheDocument();
    expect(screen.getByText(/settlements for release/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /complete purchase/i })).not.toBeInTheDocument();
  });

  it("shows payment complete state without purchase form", () => {
    render(<CheckoutPurchasePanel {...baseProps({ addresses: [], paymentComplete: true })} />);
    expect(screen.getByText(/payment recorded/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /complete purchase/i })).not.toBeInTheDocument();
  });

  it("shows bank transfer in-flight block without purchase form", () => {
    render(
      <CheckoutPurchasePanel {...baseProps({ addresses: [], openPaymentStatus: "authorized" })} />,
    );
    expect(screen.getByText(/bank transfer processing/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /complete purchase/i })).not.toBeInTheDocument();
  });

  it("shows confirming payment block after Stripe success return without purchase form", () => {
    render(
      <CheckoutPurchasePanel
        {...baseProps({
          openPaymentStatus: "pending",
          stripeReturnSuccess: true,
        })}
      />,
    );
    expect(screen.getByText(/confirming payment/i)).toBeInTheDocument();
    expect(screen.getByText(/please do not pay again/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /complete purchase/i })).not.toBeInTheDocument();
  });

  it("shows bank transfer instructions (not 'do not pay again') for a bank transfer return", () => {
    render(
      <CheckoutPurchasePanel
        {...baseProps({
          openPaymentStatus: "pending",
          openPaymentCheckoutRail: "gb_bank_transfer",
          stripeReturnSuccess: true,
        })}
      />,
    );
    expect(screen.getByText(/send your transfer to complete payment/i)).toBeInTheDocument();
    expect(screen.queryByText(/please do not pay again/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /complete purchase/i })).not.toBeInTheDocument();
  });

  it("blocks checkout when payments history failed to load", () => {
    render(<CheckoutPurchasePanel {...baseProps({ addresses: [], paymentsLoadFailed: true })} />);
    expect(
      screen.getByText(/could not confirm whether this lot is already paid/i),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /complete purchase/i })).not.toBeInTheDocument();
  });

  it("paymentComplete beats awaitingCaptureConfirmation (view precedence)", () => {
    render(
      <CheckoutPurchasePanel
        {...baseProps({
          paymentComplete: true,
          stripeReturnSuccess: true,
          openPaymentStatus: "pending",
        })}
      />,
    );
    expect(screen.getByText(/payment recorded/i)).toBeInTheDocument();
    expect(screen.queryByText(/confirming payment/i)).not.toBeInTheDocument();
  });

  it("shows order summary on confirming branch but not on payment complete", () => {
    const { rerender } = render(
      <CheckoutPurchasePanel
        {...baseProps({
          openPaymentStatus: "pending",
          stripeReturnSuccess: true,
        })}
      />,
    );
    expect(screen.getByText("Order summary")).toBeInTheDocument();

    rerender(<CheckoutPurchasePanel {...baseProps({ paymentComplete: true })} />);
    expect(screen.queryByText("Order summary")).not.toBeInTheDocument();
  });

  it("shows card-only payment copy when checkout rail is card", () => {
    render(
      <CheckoutPurchasePanel
        {...baseProps({
          openPaymentCheckoutRail: "card",
        })}
      />,
    );
    expect(screen.getByText(/pay by card via secure stripe checkout/i)).toBeInTheDocument();
  });

  it("shows bank-transfer-only payment copy when checkout rail is gb_bank_transfer", () => {
    render(
      <CheckoutPurchasePanel
        {...baseProps({
          openPaymentCheckoutRail: "gb_bank_transfer",
        })}
      />,
    );
    expect(
      screen.getByText(
        /this purchase settles by uk bank transfer via secure stripe checkout — card is not available/i,
      ),
    ).toBeInTheDocument();
  });

  it("shows default payment copy when checkout rail is unset", () => {
    render(<CheckoutPurchasePanel {...baseProps()} />);
    expect(
      screen.getByText(
        /pay by card or uk bank transfer via secure stripe checkout, depending on the amount/i,
      ),
    ).toBeInTheDocument();
  });

  it("shows source-of-funds requirements list and upload CTA", () => {
    render(
      <CheckoutPurchasePanel
        {...baseProps({
          addresses: [],
          openPaymentStatus: "requires_manual_review",
          openPaymentManualReviewReason: "source_of_funds_required",
        })}
      />,
    );
    expect(screen.getByText(/bank statements covering the funds/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /view requirements & upload/i })).toBeInTheDocument();
  });

  it("wraps address selection with arrow keys", () => {
    render(
      <CheckoutPurchasePanel
        {...baseProps({
          addresses: [defaultAddress, secondAddress],
        })}
      />,
    );

    const radiogroup = screen.getByRole("radiogroup", {
      name: /select shipping or invoice address/i,
    });
    const radios = within(radiogroup).getAllByRole("radio");
    expect(radios[0]).toHaveAttribute("aria-checked", "true");

    fireEvent.keyDown(radiogroup, { key: "ArrowUp" });
    const afterWrap = within(radiogroup).getAllByRole("radio");
    expect(afterWrap[1]).toHaveAttribute("aria-checked", "true");
  });
});
