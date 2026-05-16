import { SaleroomCatalogLotsByView } from "@/components/sections/saleroom/saleroom-catalog-lots-by-view";
import type { SaleLotCardVM } from "@/components/sections/saleroom/view-models";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

const lot: SaleLotCardVM = {
  id: "lot-1",
  href: "/lot/test/1",
  lotLabel: "Lot 1",
  title: "Test lot",
  imageUrl: null,
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

describe("SaleroomCatalogLotsByView", () => {
  it("renders cornerAction when renderCorner is provided", () => {
    render(
      <SaleroomCatalogLotsByView
        view="grid"
        lots={[lot]}
        renderCorner={() => <span data-testid="corner-action">Heart</span>}
      />,
    );
    expect(screen.getByTestId("corner-action")).toBeInTheDocument();
  });
});
