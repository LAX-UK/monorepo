import { MarketingLotOverlayActions } from "@/components/marketing/lot-quick-look/marketing-lot-overlay-actions";
import type { LotQuickLookVM } from "@/components/marketing/lot-quick-look/types";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/marketing/watchlist-heart-button", () => ({
  MarketingWatchlistHeart: () => <button type="button">Watchlist</button>,
}));

vi.mock("./lot-quick-look-trigger", () => ({
  LotQuickLookTrigger: ({
    overlaySlot,
    className,
  }: {
    overlaySlot?: string;
    className?: string;
  }) => (
    <button
      type="button"
      data-testid="quick-look"
      data-overlay-slot={overlaySlot}
      className={className}
    >
      Quick look
    </button>
  ),
}));

const vm = {
  id: "lot-1",
  title: "Test lot",
  href: "/lot/test/1",
  subtitle: "",
  imageUrl: null,
  imageAlt: "Test",
  status: "active" as const,
} satisfies LotQuickLookVM;

const baseProps = {
  lotId: "lot-1",
  lotTitle: "Test lot",
  initialWatching: false,
  isAuthenticated: false,
  loginNextPath: "/lot/test/1",
  vm,
  quickLookOptions: { isAuthenticated: false, watchedLotIds: [], loginNextPath: "/lot/test/1" },
};

describe("MarketingLotOverlayActions", () => {
  it("places quick look bottom-left by default with optional addon below", () => {
    const { container } = render(
      <MarketingLotOverlayActions
        {...baseProps}
        bottomLeftAddon={<span data-testid="bottom-addon">Badge</span>}
      />,
    );

    const quickLook = screen.getByTestId("quick-look");
    expect(quickLook).toHaveAttribute("data-overlay-slot", "bottomLeft");
    expect(screen.getByTestId("bottom-addon")).toBeInTheDocument();

    const bottomLeft = container.querySelector(".bottom-3.left-3");
    expect(bottomLeft).toContainElement(quickLook);
    expect(bottomLeft).toContainElement(screen.getByTestId("bottom-addon"));
    expect(container.querySelector(".bottom-3.right-3")).toBeNull();
  });

  it("places quick look bottom-right for saleroom tiles without a bottom-left column", () => {
    const { container } = render(
      <MarketingLotOverlayActions {...baseProps} quickLookCorner="bottomRight" />,
    );

    const quickLook = screen.getByTestId("quick-look");
    expect(quickLook).toHaveAttribute("data-overlay-slot", "bottomRight");

    const bottomRight = container.querySelector(".bottom-3.right-3");
    expect(bottomRight).toContainElement(quickLook);
    expect(container.querySelector(".bottom-3.left-3")).toBeNull();
  });

  it("renders a single root node so grid maps do not warn about missing keys", () => {
    const { container } = render(
      <MarketingLotOverlayActions {...baseProps} quickLookCorner="bottomRight" />,
    );

    expect(container.childElementCount).toBe(1);
    expect(container.firstElementChild?.className).toMatch(/absolute inset-0/);
  });
});
