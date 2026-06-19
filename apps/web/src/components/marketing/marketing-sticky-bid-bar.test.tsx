import { MarketingStickyBidBar } from "@/components/marketing/marketing-sticky-bid-bar";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

describe("MarketingStickyBidBar", () => {
  it("uses the marketing page inner column and full-width flex row", () => {
    render(
      <MarketingStickyBidBar>
        <span>Status</span>
        <button type="button">Action</button>
      </MarketingStickyBidBar>,
    );

    const row = screen.getByText("Status").parentElement;
    expect(row).toHaveClass("mx-auto");
    expect(row).toHaveClass("w-full");
    expect(row).toHaveClass("px-8");
    expect(row).toHaveClass("max-w-[var(--container-inner,1376px)]");
    expect(row).toHaveClass("flex");
    expect(row).toHaveClass("justify-between");
    expect(row?.className).not.toContain("max-w-xl");
  });
});
