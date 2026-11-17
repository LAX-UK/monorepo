import { SaleroomCatalogLotsLive } from "@/components/sections/saleroom/saleroom-catalog-lots-live";
import type { SaleLotCardVM } from "@/components/sections/saleroom/view-models";
import type { LotCardBidViewer } from "@/lib/lot-card/lot-card-bid-action";
import { liveCardFields, pendingCardVM } from "@/lib/marketing/saleroom/card-live-state";
import {
  replaceMarketingViewUrl,
  resetMarketingViewClientState,
} from "@/lib/preferences/view-url-store";
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const liveCards = vi.hoisted(() => ({ current: null as Map<string, unknown> | null }));
vi.mock("@/lib/marketing/saleroom/sale-catalogue-live.client", () => ({
  useSaleCatalogueLive: () => liveCards.current,
}));

vi.mock("@/components/lot-card/lot-card-bidder-state", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/components/lot-card/lot-card-bidder-state")>()),
  LotCardBidderState: () => null,
}));

vi.mock("@/lib/context/saleroom-live-provider", () => ({
  useSaleroomLive: () => null,
}));

vi.mock("@/components/sections/saleroom/saleroom-live-lot-banner", () => ({
  SaleroomLiveLotBanner: () => null,
}));

vi.mock("@/components/lot-card/lot-card-quick-look", () => ({
  LotCardQuickLook: () => <div data-testid="quick-look" />,
}));

vi.mock("next/image", () => ({
  default: (props: { alt: string }) => <img alt={props.alt} />,
}));

vi.mock("@/components/sections/saleroom/saleroom-lot-catalog-overlay", () => ({
  SaleroomLotCatalogOverlay: () => <span data-testid="saleroom-lot-catalog-overlay" />,
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
  liveCards.current = null;
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
  closingShort: null,
  isLive: true,
  viewerOwnsLot: false,
  artistOrMedium: "Artist",
  viewerIsWatching: false,
  status: "active",
  startTime: null,
  endTime: null,
} satisfies SaleLotCardVM;

const hybridSaleForLifecycle = {
  status: "active" as const,
  deliveryMode: "hybrid" as const,
  allowOnlineBidsBeforeGoLive: true,
};

describe("SaleroomCatalogLotsLive staff gating", () => {
  it("hides bid actions for staff while keeping quick look", () => {
    render(
      <SaleroomCatalogLotsLive
        view="grid"
        rows={[{ kind: "lot", key: lot.id, lot }]}
        saleForLifecycle={hybridSaleForLifecycle}
        isAuthenticated
        canParticipate={false}
      />,
    );

    expect(screen.queryByRole("link", { name: /bid/i })).not.toBeInTheDocument();
    expect(screen.getByTestId("quick-look")).toBeInTheDocument();
  });

  it("shows bid actions for clients", () => {
    render(
      <SaleroomCatalogLotsLive
        view="grid"
        rows={[{ kind: "lot", key: lot.id, lot }]}
        saleForLifecycle={hybridSaleForLifecycle}
        isAuthenticated
        canParticipate
      />,
    );

    expect(screen.getByRole("link", { name: /bid/i })).toBeInTheDocument();
  });
});

describe("SaleroomCatalogLotsLive view switching", () => {
  it("reacts to client view URL changes without a server prop update", () => {
    render(
      <SaleroomCatalogLotsLive
        view="grid"
        rows={[{ kind: "lot", key: lot.id, lot }]}
        saleForLifecycle={hybridSaleForLifecycle}
        isAuthenticated
        canParticipate={false}
      />,
    );

    // Grid: the heart sits on the "Lot N" line, not on the picture.
    expect(screen.getByTestId("lot-card-lot-line")).toContainElement(
      screen.getByTestId("watchlist-lot-1"),
    );

    act(() => {
      replaceMarketingViewUrl("/sales/test/sale-1?view=list", "list");
    });

    expect(screen.getByTestId("watchlist-lot-1")).toHaveAttribute("data-layout", "inline");
    expect(screen.queryByTestId("lot-card-lot-line")).not.toBeInTheDocument();
  });
});

/*
 * CO-7: the cards come from a cached page with no bid state. Until the live read lands they show
 * no price, status or close and no bid action; then the live fields fill them.
 */
describe("SaleroomCatalogLotsLive before and after the live read", () => {
  const pending = pendingCardVM(lot);
  const live = {
    saleId: "sale-1",
    reads: [{ limit: 40, offset: 0, sort: "lot" }],
    premiumSale: { buyerPremiumRate: null, buyerPremiumTiers: null },
  } as never;

  it("draws placeholders, no status pill and no bid action while pending", () => {
    const { container } = render(
      <SaleroomCatalogLotsLive
        view="grid"
        rows={[{ kind: "lot", key: lot.id, lot: pending }]}
        saleForLifecycle={hybridSaleForLifecycle}
        isAuthenticated
        canParticipate
        live={live}
      />,
    );
    expect(screen.getByTestId("lot-card-line-pending")).toBeInTheDocument();
    expect(screen.queryByTestId("saleroom-lot-catalog-overlay")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /bid/i })).not.toBeInTheDocument();
    expect(container.textContent).not.toContain("£500");
    expect(container.textContent).not.toContain("Current bid");
  });

  it.each(["scheduled", "draft"] as const)(
    "draws no action slot and no skeleton while pending on an onsite %s sale",
    (status) => {
      const { container } = render(
        <SaleroomCatalogLotsLive
          view="grid"
          rows={[{ kind: "lot", key: lot.id, lot: pending }]}
          saleForLifecycle={{ status, deliveryMode: "onsite" }}
          isAuthenticated
          canParticipate
          live={live}
        />,
      );
      expect(screen.getByTestId("lot-card-line-pending")).toBeInTheDocument();
      expect(container.querySelector("[data-testid='lot-card-action']")).toBeNull();
      expect(container.querySelector(".lax-skeleton[class*='control']")).toBeNull();
    },
  );

  it("keeps the action's place while pending on a sale that can show a button", () => {
    const { container } = render(
      <SaleroomCatalogLotsLive
        view="grid"
        rows={[{ kind: "lot", key: lot.id, lot: pending }]}
        saleForLifecycle={hybridSaleForLifecycle}
        isAuthenticated
        canParticipate
        live={live}
      />,
    );
    expect(container.querySelector("[data-testid='lot-card-action'] .lax-skeleton")).not.toBeNull();
  });

  it("fills the card from the live read", () => {
    liveCards.current = new Map([[lot.id, liveCardFields(lot)]]);
    render(
      <SaleroomCatalogLotsLive
        view="grid"
        rows={[{ kind: "lot", key: lot.id, lot: pending }]}
        saleForLifecycle={hybridSaleForLifecycle}
        isAuthenticated
        canParticipate
        live={live}
      />,
    );
    expect(screen.queryByTestId("lot-card-line-pending")).not.toBeInTheDocument();
    expect(screen.getByTestId("saleroom-lot-catalog-overlay")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /bid/i })).toBeInTheDocument();
    expect(screen.getByTestId("lot-card-line").textContent).toContain("£500");
  });
});

/*
 * The card's full-width button names what it does for this viewer: "Bid" on an open lot,
 * "Register to bid" before the sale opens for someone who must still register, "Leave a bid"
 * before the lot opens for someone who may bid and a sale that takes bids in advance.
 */
describe("SaleroomCatalogLotsLive card button label", () => {
  const scheduled = { ...lot, status: "scheduled" as const };
  const onlineScheduledSale = { status: "scheduled" as const, deliveryMode: "online" as const };

  function renderCard(
    cardLot: SaleLotCardVM,
    bidViewer: LotCardBidViewer,
    sale: Parameters<typeof SaleroomCatalogLotsLive>[0]["saleForLifecycle"] = onlineScheduledSale,
  ) {
    return render(
      <SaleroomCatalogLotsLive
        view="grid"
        rows={[{ kind: "lot", key: cardLot.id, lot: cardLot }]}
        saleForLifecycle={sale}
        isAuthenticated={bidViewer?.signedIn ?? false}
        canParticipate
        bidViewer={bidViewer}
      />,
    );
  }

  it("says Bid on an open lot and goes to the lot page", () => {
    renderCard(
      lot,
      { signedIn: false, register: { href: "/sign-up", label: "Register to bid" } },
      hybridSaleForLifecycle,
    );
    const button = screen.getByRole("link", { name: "Bid" });
    expect(button).toHaveAttribute("href", lot.href);
  });

  it("says Register to bid before the sale opens for a viewer who must register", () => {
    renderCard(scheduled, {
      signedIn: true,
      register: { href: "#register-to-bid", label: "Register to bid" },
    });
    const button = screen.getByRole("link", { name: "Register to bid" });
    expect(button).toHaveAttribute("href", "#register-to-bid");
    expect(screen.queryByRole("link", { name: "Bid" })).not.toBeInTheDocument();
  });

  it("names the hero's own step when it is not registration (identity, buyer profile)", () => {
    const { unmount } = renderCard(scheduled, {
      signedIn: true,
      register: { href: "/onboarding/identity?next=%2Fsales", label: "Verify identity to bid" },
    });
    expect(screen.getByRole("link", { name: "Verify identity to bid" })).toHaveAttribute(
      "href",
      "/onboarding/identity?next=%2Fsales",
    );
    expect(screen.queryByRole("link", { name: "Register to bid" })).not.toBeInTheDocument();
    unmount();
    renderCard(scheduled, {
      signedIn: true,
      register: { href: "/onboarding/organisation", label: "Set up a buyer profile" },
    });
    expect(screen.getByRole("link", { name: "Set up a buyer profile" })).toHaveAttribute(
      "href",
      "/onboarding/organisation",
    );
    expect(screen.queryByRole("link", { name: "Register to bid" })).not.toBeInTheDocument();
  });

  it("says Leave a bid before opening for a registered viewer when advance bids are taken", () => {
    renderCard(scheduled, { signedIn: true, register: null });
    const button = screen.getByRole("link", { name: "Leave a bid" });
    expect(button).toHaveAttribute("href", `${lot.href}?bid=open`);
  });

  it("offers no button before opening when the sale takes no advance bids", () => {
    renderCard(
      scheduled,
      { signedIn: true, register: null },
      { status: "scheduled", deliveryMode: "hybrid", allowOnlineBidsBeforeGoLive: false },
    );
    expect(screen.queryByRole("link", { name: /bid/i })).not.toBeInTheDocument();
  });

  it("keeps the button's place, with no label, until the viewer is known", () => {
    const { container } = renderCard(scheduled, null);
    expect(screen.queryByRole("link", { name: /bid/i })).not.toBeInTheDocument();
    expect(container.querySelector("[data-testid='lot-card-action'] .lax-skeleton")).not.toBeNull();
  });

  it("draws no placeholder before the viewer read on a sale that offers no button (onsite)", () => {
    const { container } = renderCard(scheduled, null, {
      status: "scheduled",
      deliveryMode: "onsite",
    });
    expect(container.querySelector("[data-testid='lot-card-action']")).toBeNull();
  });
});
