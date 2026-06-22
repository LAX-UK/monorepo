import { SaleroomCatalogLotsLive } from "@/components/sections/saleroom/saleroom-catalog-lots-live";
import type { SaleLotCardVM } from "@/components/sections/saleroom/view-models";
import {
  replaceMarketingViewUrl,
  resetMarketingViewClientState,
} from "@/lib/preferences/view-url-store";
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/context/saleroom-live-provider", () => ({
  useSaleroomLive: () => null,
}));

vi.mock("@/components/sections/saleroom/saleroom-live-lot-banner", () => ({
  SaleroomLiveLotBanner: () => null,
}));

vi.mock("@/components/marketing/lot-quick-look/saleroom-lot-quick-look-corner", () => ({
  SaleroomLotQuickLookCorner: () => <div data-testid="quick-look" />,
}));

vi.mock("next/image", () => ({
  default: (props: { alt: string }) => <img alt={props.alt} />,
}));

vi.mock("@/components/marketing/lot-status-badge", () => ({
  LotStatusBadge: () => <span data-testid="lot-status-badge" />,
  LotStatusTimer: () => <span data-testid="lot-status-timer" />,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/components/marketing/watchlist-heart-button", () => ({
  MarketingWatchlistHeart: ({
    lotId,
    layout,
  }: {
    lotId: string;
    layout?: string;
  }) => (
    <button type="button" data-testid={`watchlist-${lotId}`} data-layout={layout ?? "overlay"}>
      Watchlist
    </button>
  ),
}));

vi.mock("@/components/marketing/lot-quick-look/lot-quick-look-trigger", () => ({
  LotQuickLookTrigger: () => <button type="button" data-testid="quick-look-trigger" />,
}));

beforeEach(() => {
  resetMarketingViewClientState();
  window.history.replaceState({}, "", "/");

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

afterEach(() => {
  resetMarketingViewClientState();
  window.history.replaceState({}, "", "/");
});

const lot = {
  id: "lot-1",
  href: "/lot/test/lot-1",
  title: "Test Lot",
  lotNumber: 1,
  lotLabel: "Lot 1",
  imageUrl: "https://example.com/lot.jpg",
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

describe("SaleroomCatalogLotsLive view switching", () => {
  it("reacts to client view URL changes without a server prop update", () => {
    render(
      <SaleroomCatalogLotsLive view="grid" lots={[lot]} isAuthenticated canParticipate={false} />,
    );

    expect(screen.queryByTestId("watchlist-lot-1")).not.toBeInTheDocument();

    act(() => {
      replaceMarketingViewUrl("/sales/test/sale-1?view=list", "list");
    });

    expect(screen.getByTestId("watchlist-lot-1")).toHaveAttribute("data-layout", "inline");
  });
});
