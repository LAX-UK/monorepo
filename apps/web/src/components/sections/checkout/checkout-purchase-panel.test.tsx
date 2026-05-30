import { CheckoutPurchasePanel } from "@/components/sections/checkout/checkout-purchase-panel";
import type { SessionUser } from "@/lib/data/contracts";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/actions/checkout", () => ({
  createCheckoutPaymentAction: vi.fn(),
}));

vi.mock("@/lib/analytics/events", () => ({
  trackBeginCheckout: vi.fn(),
  trackPurchase: vi.fn(),
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

  it("shows payment complete state without purchase form", () => {
    render(
      <CheckoutPurchasePanel
        sessionUser={user}
        lotId="00000000-0000-4000-8000-000000000001"
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
});
