import { SaleroomLotCard } from "@/components/sections/saleroom/saleroom-lot-card";
import type { SaleroomSaleForLifecycle } from "@/components/sections/saleroom/saleroom-lot-catalog-overlay";
import type { SaleLotCardVM } from "@/components/sections/saleroom/view-models";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

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
  estimateValue: "£1,000",
  currentBidLabel: "Current bid",
  currentBidValue: "£500",
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
  it("renders saleroom overlay inside the tile image link", () => {
    const { container } = render(
      <SaleroomLotCard
        lot={lot}
        saleForLifecycle={hybridSaleForLifecycle}
        cornerAction={<span data-testid="corner">Corner</span>}
      />,
    );

    const imageLink = screen.getByRole("link", { name: "Lot 1: Test lot" });
    const overlay = screen.getByTestId("saleroom-lot-catalog-overlay");
    expect(imageLink).toContainElement(overlay);
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

  it("reserves equal text block heights on tile cards", () => {
    const { container } = render(
      <SaleroomLotCard
        lot={{ ...lot, lotLabel: null, artistOrMedium: null }}
        saleForLifecycle={hybridSaleForLifecycle}
      />,
    );

    const titleLink = container.querySelector("a.min-h-12");
    expect(titleLink).toBeInTheDocument();
    expect(titleLink?.textContent).toBe("Test lot");

    const labels = screen.getAllByText("Lot");
    expect(labels.some((el) => el.className.includes("invisible"))).toBe(true);

    const artistLine = titleLink?.parentElement?.querySelector("p.min-h-4");
    expect(artistLine).toBeInTheDocument();
  });
});
