import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MarketingAccountSheet } from "./marketing-account-sheet.js";

describe("MarketingAccountSheet", () => {
  it("shows the product's rows under the title when open", () => {
    render(
      <MarketingAccountSheet open onOpenChange={() => {}} title="Sam">
        <a href="/orders">Orders</a>
      </MarketingAccountSheet>,
    );
    expect(screen.getByRole("dialog", { name: "Sam" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Orders" })).toBeInTheDocument();
  });

  it("renders nothing when closed and reports close requests", () => {
    const onOpenChange = vi.fn();
    const { rerender } = render(
      <MarketingAccountSheet open={false} onOpenChange={onOpenChange} title="Sam">
        <a href="/orders">Orders</a>
      </MarketingAccountSheet>,
    );
    expect(screen.queryByRole("dialog")).toBeNull();
    rerender(
      <MarketingAccountSheet open onOpenChange={onOpenChange} title="Sam">
        <a href="/orders">Orders</a>
      </MarketingAccountSheet>,
    );
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
