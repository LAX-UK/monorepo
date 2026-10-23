import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { PayNowBanner } from "./pay-now-banner";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

describe("PayNowBanner", () => {
  it("shows what is owed and a Pay now link to checkout", () => {
    render(<PayNowBanner payNow={{ dueCount: 2, outstandingLabel: "£2,500.00", href: "/x" }} />);
    expect(screen.getByText("Payment due: £2,500.00")).toBeInTheDocument();
    expect(screen.getByText("2 lots won and waiting for payment.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Pay now" })).toHaveAttribute("href", "/x");
  });

  it("uses the singular for one lot", () => {
    render(<PayNowBanner payNow={{ dueCount: 1, outstandingLabel: "£100.00", href: "/x" }} />);
    expect(screen.getByText("1 lot won and waiting for payment.")).toBeInTheDocument();
  });

  it("explains instead of offering a button while every lot is in review", () => {
    render(<PayNowBanner payNow={{ dueCount: 1, outstandingLabel: "£100.00", href: null }} />);
    expect(screen.queryByRole("link", { name: "Pay now" })).toBeNull();
    expect(screen.getByText(/reviewing your account/i)).toBeInTheDocument();
  });
});
