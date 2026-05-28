import { CheckoutBasketPanel } from "@/components/sections/checkout/checkout-basket-panel";
import type { Lot } from "@auction/types";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard/checkout",
}));

const lot = {
  id: "11111111-1111-1111-1111-111111111111",
  title: "Test lot",
  slug: "test-lot",
} as unknown as Lot;

describe("CheckoutBasketPanel", () => {
  it("renders sticky combined total with tab bar offset on dashboard routes", () => {
    const { container } = render(
      <CheckoutBasketPanel
        rows={[
          {
            lot,
            hammer: 100,
            premium: 25,
            total: 125,
            premiumPercentLabel: "25%",
          },
        ]}
        grandTotal={125}
      />,
    );

    expect(screen.getByText("Combined total")).toBeInTheDocument();
    const sticky = container.querySelector("[style*='bottom']");
    expect(sticky?.getAttribute("style")).toContain("--bottom-nav-height");
  });
});
