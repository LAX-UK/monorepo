import { SaleroomCatalogLotsLive } from "@/components/sections/saleroom/saleroom-catalog-lots-live";
import type { SaleLotCardVM } from "@/components/sections/saleroom/view-models";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/context/saleroom-live-provider", () => ({
  useSaleroomLive: () => null,
}));

vi.mock("@/components/marketing/lot-quick-look/saleroom-lot-quick-look-corner", () => ({
  SaleroomLotQuickLookCorner: () => <div data-testid="quick-look" />,
}));

const lot = {
  id: "lot-1",
  href: "/lot/test/lot-1",
  title: "Test Lot",
  lotNumber: 1,
  lotLabel: "Lot 1",
  imageUrl: null,
  imageAlt: "",
  estimateValue: "£1,000",
  currentBidLabel: "Current bid",
  currentBidValue: "£500",
  bidsCountLabel: null,
  closingLabel: null,
  closingShort: null,
  isLive: true,
  viewerOwnsLot: false,
  artistOrMedium: "Artist",
  viewerIsWatching: false,
  status: "active",
  startTime: null,
  endTime: null,
} satisfies SaleLotCardVM;

describe("SaleroomCatalogLotsLive staff gating", () => {
  it("hides bid actions for staff while keeping quick-look overlay", () => {
    render(
      <SaleroomCatalogLotsLive view="grid" lots={[lot]} isAuthenticated canParticipate={false} />,
    );

    expect(screen.queryByRole("link", { name: /bid/i })).not.toBeInTheDocument();
    expect(screen.getByTestId("quick-look")).toBeInTheDocument();
  });

  it("shows bid actions for clients", () => {
    render(<SaleroomCatalogLotsLive view="grid" lots={[lot]} isAuthenticated canParticipate />);

    expect(screen.getByRole("link", { name: /bid/i })).toBeInTheDocument();
  });
});
