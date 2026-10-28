import type { MyBidCardVm } from "@/lib/bid/my-bids.vm";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { MyBidsList } from "./my-bids-list";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("@/components/ui/media-image", () => ({ MediaImage: () => null }));

vi.mock("@/components/dashboard/bid-history-drawer", () => ({
  BidHistoryDrawer: ({ open, lotTitle }: { open: boolean; lotTitle: string }) =>
    open ? <div role="dialog" aria-label={`Bid history: ${lotTitle}`} /> : null,
}));

function card(n: number): MyBidCardVm {
  return {
    id: `b${n}`,
    lotId: `lot-${n}`,
    href: `/lot/${n}`,
    image: null,
    title: n === 3 ? "The lute player" : `Work ${n}`,
    lotLabel: `Lot ${n}`,
    saleTitle: "Autumn modern",
    details: null,
    placementNote: null,
    status: "winning",
    statusLabel: "Winning",
    figures: [],
    actions: [],
  };
}

describe("MyBidsList", () => {
  it("opens the lot's bid history from its card", () => {
    render(<MyBidsList cards={[card(1), card(3)]} />);
    fireEvent.click(screen.getByRole("button", { name: "Bid history for The lute player" }));
    expect(
      screen.getByRole("dialog", { name: "Bid history: The lute player" }),
    ).toBeInTheDocument();
  });

  it("shows a search field only for a long view, and filters the cards", () => {
    const { rerender } = render(<MyBidsList cards={[card(1), card(3)]} />);
    expect(screen.queryByRole("searchbox")).toBeNull();

    rerender(<MyBidsList cards={Array.from({ length: 9 }, (_, i) => card(i + 1))} />);
    fireEvent.change(screen.getByRole("searchbox", { name: "Search these bids" }), {
      target: { value: "lute" },
    });
    expect(screen.getAllByRole("article")).toHaveLength(1);
    expect(screen.getByText("1 of 9 bids shown")).toBeInTheDocument();
  });
});
