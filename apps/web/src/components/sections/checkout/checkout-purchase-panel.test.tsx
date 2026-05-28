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

const user = { id: "user-1", role: "client" } as SessionUser;

describe("CheckoutPurchasePanel", () => {
  it("hides inline submit below lg when mobile chrome owns the CTA", () => {
    render(
      <CheckoutPurchasePanel
        sessionUser={user}
        lotId="lot-1"
        hammer="£100"
        buyerPremium="£25"
        total="£125"
        premiumPercentLabel="25%"
        addresses={[
          {
            id: "addr-1",
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

    const submit = screen.getByRole("button", { name: /complete purchase/i });
    expect(submit.className).toMatch(/\bhidden\b/);
    expect(submit.className).toMatch(/\blg:flex\b/);
  });
});
