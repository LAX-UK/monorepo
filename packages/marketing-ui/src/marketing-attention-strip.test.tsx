import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MarketingAttentionStrip } from "./marketing-attention-strip.js";

const PROPS = { label: "Payment due", actionLabel: "Pay now", href: "/account/payments" };

describe("MarketingAttentionStrip", () => {
  it("below 640px is a 44px full-width strip: label on the left, action and chevron on the right", () => {
    render(<MarketingAttentionStrip {...PROPS} />);
    const strip = screen.getByTestId("attention-strip");
    expect(strip).toHaveAttribute("href", "/account/payments");
    expect(strip.textContent).toBe("Payment duePay now›");
    expect(screen.getByText("Pay now").className).toContain("underline");
    expect(strip.className).toContain("h-11");
    expect(strip.className).toContain("w-full");
    expect(strip.className).toContain("sm:hidden");
  });

  it("is not sticky, so it scrolls with the page", () => {
    render(<MarketingAttentionStrip {...PROPS} />);
    const cls = screen.getByTestId("attention-strip").className;
    expect(cls).not.toMatch(/\b(sticky|fixed)\b/);
  });

  it("from 640px shows the inline chip instead", () => {
    render(<MarketingAttentionStrip {...PROPS} />);
    const chip = screen.getByTestId("attention-chip");
    expect(chip.className).toContain("hidden");
    expect(chip.className).toContain("sm:inline-flex");
    expect(chip).toHaveTextContent("Payment due");
    expect(chip).toHaveAttribute("href", "/account/payments");
  });

  it("gives both the same accessible name", () => {
    render(<MarketingAttentionStrip {...PROPS} accessibleName="Payment due for lot 4" />);
    expect(screen.getAllByRole("link", { name: "Payment due for lot 4" })).toHaveLength(2);
  });
});
