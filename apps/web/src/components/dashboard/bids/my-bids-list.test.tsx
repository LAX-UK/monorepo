import type { MyBidCardVm } from "@/lib/bid/my-bids.vm";
import { fireEvent, render, screen, within } from "@testing-library/react";
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

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

// The row menu as plain buttons: opening a real Radix menu in jsdom is slow.
vi.mock("@auction/ui", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@auction/ui")>()),
  InlineActionMenu: ({
    label,
    items,
  }: {
    label: string;
    items: { type: string; label?: string; onSelect?: () => void }[];
  }) => (
    <fieldset aria-label={label}>
      {items.map((item) =>
        item.type === "item" ? (
          <button key={item.label} type="button" onClick={item.onSelect}>
            {item.label}
          </button>
        ) : null,
      )}
    </fieldset>
  ),
}));

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
  it("opens the lot's bid history from its row menu", () => {
    render(<MyBidsList cards={[card(1), card(3)]} />);
    const menu = screen.getByRole("group", { name: "More for The lute player" });
    fireEvent.click(within(menu).getByRole("button", { name: "Bid history" }));
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
    const list = screen.getByRole("list", { name: "Lots you have bid on" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(1);
    expect(screen.getByText("1 of 9 bids shown")).toBeInTheDocument();
  });
});

describe("MyBidsList, no results", () => {
  it("names the search that matched nothing and clears it", () => {
    render(<MyBidsList cards={Array.from({ length: 9 }, (_, i) => card(i + 1))} />);
    const search = screen.getByRole("searchbox", { name: "Search these bids" });
    fireEvent.change(search, { target: { value: "hockney" } });
    expect(screen.getByRole("heading", { name: "No bids match “hockney”" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(search).toHaveValue("");
    expect(screen.getAllByRole("listitem")).toHaveLength(9);
  });
});
