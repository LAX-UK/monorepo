import { SaleroomLotCard } from "@/components/sections/saleroom/saleroom-lot-card";
import type { SaleroomSaleForLifecycle } from "@/components/sections/saleroom/saleroom-lot-catalog-overlay";
import type { SaleLotCardVM } from "@/components/sections/saleroom/view-models";
import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/lot-card/lot-card-bidder-state", () => ({
  LotCardBidderState: () => null,
}));

vi.mock("next/image", () => ({
  default: (props: { alt: string }) => <img alt={props.alt} />,
}));

vi.mock("@/components/sections/saleroom/saleroom-lot-catalog-overlay", () => ({
  SaleroomLotCatalogOverlay: ({ layout }: { layout?: string }) => (
    <span data-testid="saleroom-lot-catalog-overlay" data-layout={layout ?? "overlay"} />
  ),
}));

beforeEach(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

const hybridSaleForLifecycle: SaleroomSaleForLifecycle = {
  status: "active",
  deliveryMode: "hybrid",
  allowOnlineBidsBeforeGoLive: true,
};

const lot: SaleLotCardVM = {
  id: "lot-1",
  href: "/lot/test/1",
  lotLabel: "Lot 1",
  title: "Test lot",
  imageUrl: "https://example.com/lot.jpg",
  imageAlt: "Test",
  displayStyle: "wall",
  estimateValue: "£1,000",
  currentBidLabel: "Current bid",
  currentBidValue: "£500",
  cardLine: {
    label: "Current bid",
    value: "£500",
    time: "none",
    startsAt: null,
    endsAt: null,
  },
  bidsCountLabel: null,
  closingLabel: null,
  isLive: true,
  viewerOwnsLot: false,
  artistOrMedium: "Artist Name",
  viewerIsWatching: false,
  status: "active",
  startTime: "2026-01-01T00:00:00.000Z",
  endTime: "2026-01-02T00:00:00.000Z",
  closingShort: null,
};

describe("SaleroomLotCard", () => {
  it("renders the saleroom overlay on the tile's picture, and quick look beside it", () => {
    const { container } = render(
      <SaleroomLotCard
        lot={lot}
        saleForLifecycle={hybridSaleForLifecycle}
        extras={{ quickLook: <span data-testid="corner">Corner</span> }}
      />,
    );

    const picture = screen.getByTestId("lot-card-media");
    const overlay = screen.getByTestId("saleroom-lot-catalog-overlay");
    expect(picture).toContainElement(overlay);
    expect(picture.querySelector("a")).toHaveAttribute("href", lot.href);
    expect(overlay).toHaveAttribute("data-layout", "overlay");
    expect(screen.getByTestId("corner")).toBeInTheDocument();
    expect(container.querySelector("[data-overlay-resolved]")).toBeInTheDocument();
  });

  it("renders listActions beside the title, not on the list thumb", () => {
    const { container } = render(
      <SaleroomLotCard
        lot={lot}
        saleForLifecycle={hybridSaleForLifecycle}
        layout="row"
        listActions={<span data-testid="list-actions">Actions</span>}
      />,
    );

    const thumb = container.querySelector(".size-24");
    const listActions = screen.getByTestId("list-actions");
    expect(thumb).toBeInTheDocument();
    expect(thumb).not.toContainElement(listActions);
    expect(container.querySelector(".pointer-events-none.absolute.inset-0")).toBeNull();
  });

  it("clamps a long title to two lines and pins the price block to the bottom of the tile", () => {
    const { container } = render(
      <SaleroomLotCard
        lot={{ ...lot, lotLabel: null, artistOrMedium: null }}
        saleForLifecycle={hybridSaleForLifecycle}
      />,
    );

    const title = screen.getByRole("heading", { name: "Test lot" });
    expect(title.className).toContain("line-clamp-2");
    expect(title.className).not.toContain("min-h");
    expect(within(title).getByRole("link", { name: "Test lot" })).toHaveAttribute("href", lot.href);
    // The foot (estimate, price, button) is pinned to the bottom of the card (styles/lot-card.css).
    expect(
      container.querySelector(".lot-card-foot [data-testid='lot-card-line']"),
    ).toBeInTheDocument();
  });
});
