import { SaleroomLotCatalogOverlay } from "@/components/sections/saleroom/saleroom-lot-catalog-overlay";
import type { SaleLotCardVM } from "@/components/sections/saleroom/view-models";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const useSaleroomLive = vi.fn();
const useNow = vi.fn();

vi.mock("@/lib/context/saleroom-live-provider", () => ({
  useSaleroomLive: () => useSaleroomLive(),
}));

vi.mock("@/hooks/use-now", () => ({
  useNow: () => useNow(),
}));

const hybridSaleForLifecycle = {
  status: "active" as const,
  deliveryMode: "hybrid" as const,
  allowOnlineBidsBeforeGoLive: true,
};

const pastEndLot: SaleLotCardVM = {
  id: "lot-1",
  href: "/lot/test/1",
  lotLabel: "Lot 1",
  title: "On-block demo lot 1",
  imageUrl: "https://example.com/lot.jpg",
  imageAlt: "Test",
  estimateValue: "£1,000",
  currentBidLabel: "Current bid",
  currentBidValue: "£2,600",
  bidsCountLabel: null,
  closingLabel: null,
  closingShort: null,
  isLive: true,
  viewerOwnsLot: false,
  artistOrMedium: "Artist",
  viewerIsWatching: false,
  status: "active",
  startTime: "2026-06-17T12:00:00.000Z",
  endTime: "2026-06-18T12:00:00.000Z",
  isOnBlock: true,
};

beforeEach(() => {
  useNow.mockReturnValue(Date.parse("2026-06-19T12:00:00.000Z"));
  useSaleroomLive.mockReturnValue({
    status: "live",
    isSessionLive: true,
    isLotOnBlock: (lotId: string) => lotId === "lot-1",
    isLotUpNext: (lotId: string) => lotId === "lot-2",
  });
});

describe("SaleroomLotCatalogOverlay", () => {
  it("hides overlay for on-block lot past catalog end while session is live", () => {
    const { container } = render(
      <SaleroomLotCatalogOverlay
        lot={pastEndLot}
        saleForLifecycle={hybridSaleForLifecycle}
        layout="overlay"
        useOverlayChrome
      />,
    );

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText("Closed")).not.toBeInTheDocument();
  });

  it("shows Up next for off-block lot flagged as next in run order", () => {
    render(
      <SaleroomLotCatalogOverlay
        lot={{ ...pastEndLot, id: "lot-2", isOnBlock: false, isUpNext: true }}
        saleForLifecycle={hybridSaleForLifecycle}
        layout="overlay"
        useOverlayChrome
      />,
    );

    expect(screen.getByText("Up next")).toBeInTheDocument();
    expect(screen.queryByText("Closed")).not.toBeInTheDocument();
  });

  it("shows In saleroom for off-block active lot past catalog end while session is live", () => {
    render(
      <SaleroomLotCatalogOverlay
        lot={{ ...pastEndLot, id: "lot-3", isOnBlock: false }}
        saleForLifecycle={hybridSaleForLifecycle}
        layout="overlay"
        useOverlayChrome
      />,
    );

    expect(screen.getByText("In saleroom")).toBeInTheDocument();
    expect(screen.queryByText("Closed")).not.toBeInTheDocument();
  });

  it("shows Sold when lot status is patched to ended with winner", () => {
    render(
      <SaleroomLotCatalogOverlay
        lot={{
          ...pastEndLot,
          id: "lot-4",
          isOnBlock: false,
          status: "ended",
          winnerId: "user-1",
          hasWinner: true,
        }}
        saleForLifecycle={hybridSaleForLifecycle}
        layout="overlay"
        useOverlayChrome
      />,
    );

    expect(screen.getByText("Sold")).toBeInTheDocument();
    expect(screen.queryByText("In saleroom")).not.toBeInTheDocument();
  });
});
