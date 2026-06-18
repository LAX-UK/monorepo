import { BidForm } from "@/components/sections/artwork/bid-form";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

describe("BidForm", () => {
  const baseProps = {
    auctionType: "english" as const,
    minNumeric: 100,
    amount: "110.00",
    maxAuto: "",
    onAmountChange: vi.fn(),
    onMaxAutoChange: vi.fn(),
    onReview: vi.fn(),
    onUseMinimum: vi.fn(),
    error: null,
    amountFieldVariant: "stepper" as const,
    stepNumeric: 10,
  };

  it("disables stepper, min, and review when biddingDisabled is true", () => {
    render(<BidForm {...baseProps} biddingDisabled />);

    expect(screen.getByRole("button", { name: /decrease bid/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /increase bid/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /min/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /review bid/i })).toBeDisabled();
  });

  it("keeps amount controls enabled when biddingDisabled is false", () => {
    render(<BidForm {...baseProps} biddingDisabled={false} />);

    expect(screen.getByRole("button", { name: /decrease bid/i })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: /increase bid/i })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: /min/i })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: /review bid/i })).not.toBeDisabled();
  });

  it("disables quick-bid chips when biddingDisabled is true", () => {
    render(<BidForm {...baseProps} amountFieldVariant="input" biddingDisabled />);

    expect(screen.getByRole("button", { name: /\+£500\.00/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /min/i })).toBeDisabled();
  });
});
