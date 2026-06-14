import { CheckoutReturnBanner } from "@/components/sections/checkout/checkout-return-banner";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh, replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams("payment=success"),
  usePathname: () => "/dashboard/checkout/lot-1",
}));

describe("CheckoutReturnBanner", () => {
  it("shows success copy after Stripe return", () => {
    render(<CheckoutReturnBanner lotTitle="Blue Canvas Study" />);
    expect(screen.getByText(/returned from stripe/i)).toBeInTheDocument();
    expect(refresh).toHaveBeenCalled();
  });
});
