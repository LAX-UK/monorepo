import { CookieDock } from "@/components/marketing/consent/cookie-dock";
import { SaleMobileSummaryBar } from "@/components/marketing/sale-mobile-summary-bar";
import type { SaleroomLotRef } from "@/lib/saleroom/saleroom-mobile-chrome";
import { MarketingBottomTabBar } from "@auction/marketing-ui";
import type { Sale } from "@auction/types";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

let scrolledOut = true;
let saleroom: { status: string; currentLotId: string | null } | null = null;

vi.mock("@/hooks/use-sale-phone-bar-visible", () => ({
  useSalePhoneBarVisible: () => scrolledOut,
}));
vi.mock("@/lib/context/saleroom-live-provider", () => ({
  useSaleroomLive: () => saleroom,
}));
vi.mock("@/lib/sale/use-active-sale-countdown-end-iso", () => ({
  useActiveSaleCountdownEndIso: () => "2026-11-20T18:00:00.000Z",
}));
vi.mock("@/components/sections/artwork/onsite/onsite-calendar-actions", () => ({
  AddSaleToCalendarButton: ({ className }: { className?: string }) => (
    <button type="button" className={className}>
      Add to calendar
    </button>
  ),
}));

vi.stubGlobal(
  "ResizeObserver",
  class {
    observe() {}
    disconnect() {}
    unobserve() {}
  },
);

const START = new Date("2026-11-18T10:00:00Z");
const END = new Date("2026-11-20T18:00:00Z");
const LOTS: SaleroomLotRef[] = [
  { id: "lot-1", lotNumber: 1, title: "Estuary", href: "/lot/estuary/lot-1", status: "sold" },
  { id: "lot-2", lotNumber: 2, title: "Harbour", href: "/lot/harbour/lot-2", status: "active" },
];

function renderBar(props: Partial<React.ComponentProps<typeof SaleMobileSummaryBar>> = {}) {
  return render(
    <>
      <CookieDock />
      <MarketingBottomTabBar
        tabs={[{ key: "home", label: "Home", icon: null, href: "/", paths: ["/"] }]}
        pathname="/sales/spring"
        onSearch={() => {}}
      />
      <SaleMobileSummaryBar
        start={START}
        end={END}
        status="active"
        saleTitle="Spring sale"
        {...props}
      />
    </>,
  );
}

const bar = () => screen.queryByRole("region", { name: "Sale" });
const tabBar = () => screen.getByRole("navigation", { hidden: true });

beforeEach(() => {
  scrolledOut = true;
  saleroom = null;
});

describe("SaleMobileSummaryBar", () => {
  it("waits for the hero's actions to scroll out, and leaves the tab bar alone until then", () => {
    scrolledOut = false;
    renderBar();
    expect(bar()).toBeNull();
    expect(tabBar()).not.toHaveAttribute("data-hidden-reason", "slot-claimed");
  });

  it("then takes the bottom slot, in the kit's bottom-bar look, and gives it back when it goes", () => {
    const view = renderBar();
    const region = bar();
    expect(region).toBeInTheDocument();
    expect(region?.className).toContain("bg-lax-raised");
    expect(region?.className).toContain("md:hidden");
    expect(region).toHaveAttribute("data-lax-density", "client");
    expect(tabBar()).toHaveAttribute("data-hidden-reason", "slot-claimed");
    view.unmount();
  });

  it("releases the slot when the actions come back into view", () => {
    const view = renderBar();
    expect(tabBar()).toHaveAttribute("data-hidden-reason", "slot-claimed");
    scrolledOut = false;
    view.rerender(
      <>
        <CookieDock />
        <MarketingBottomTabBar
          tabs={[{ key: "home", label: "Home", icon: null, href: "/", paths: ["/"] }]}
          pathname="/sales/spring"
          onSearch={() => {}}
        />
        <SaleMobileSummaryBar start={START} end={END} status="active" saleTitle="Spring sale" />
      </>,
    );
    expect(bar()).toBeNull();
    expect(tabBar()).not.toHaveAttribute("data-hidden-reason", "slot-claimed");
  });

  it("offers View lots on a live online sale, with the closing time and one primary action", () => {
    renderBar();
    expect(screen.getByText("Live sale")).toBeInTheDocument();
    const action = screen.getByRole("link", { name: "View lots" });
    expect(action).toHaveAttribute("href", "#catalog");
    expect(action.className).toContain("bg-lax-ink");
  });

  it("offers Register on an upcoming sale, and View lots to a member who only watches", () => {
    const { unmount } = renderBar({ status: "scheduled" });
    expect(screen.getByRole("link", { name: "Register" })).toHaveAttribute("href", "/register");
    unmount();
    renderBar({ status: "scheduled", canParticipate: false });
    expect(screen.getByRole("link", { name: "View lots" })).toBeInTheDocument();
  });

  it("offers Add to calendar for an upcoming onsite sale", () => {
    renderBar({
      status: "scheduled",
      deliveryMode: "onsite",
      sale: { id: "s1", title: "Spring" } as Sale,
    });
    expect(screen.getByRole("button", { name: "Add to calendar" })).toBeInTheDocument();
  });

  it("offers Watch live, then directions, then Plan visit, for a live onsite sale", () => {
    const watch = renderBar({
      deliveryMode: "onsite",
      streamUrl: "https://stream.example/spring",
    });
    expect(screen.getByRole("link", { name: /Watch live/ })).toHaveAttribute(
      "href",
      "https://stream.example/spring",
    );
    watch.unmount();
    const directions = renderBar({ deliveryMode: "onsite", directionsUrl: "https://maps.example" });
    expect(screen.getByRole("link", { name: "Get directions" })).toBeInTheDocument();
    directions.unmount();
    renderBar({ deliveryMode: "onsite" });
    expect(screen.getByRole("link", { name: "Plan visit" })).toHaveAttribute("href", "#plan-visit");
  });

  it("offers View results on an ended sale once its bar shows", () => {
    renderBar({ status: "ended" });
    expect(screen.getByRole("link", { name: "View results" })).toHaveAttribute("href", "#catalog");
  });

  it("holds an ended or hybrid sale's bar back the same way", () => {
    scrolledOut = false;
    const ended = renderBar({ status: "ended" });
    expect(bar()).toBeNull();
    ended.unmount();
    saleroom = { status: "live", currentLotId: "lot-2" };
    renderBar({ deliveryMode: "hybrid", saleroomLotRefs: LOTS });
    expect(bar()).toBeNull();
  });

  it("offers Bid now on the lot on the block in a hybrid sale, and View lots to a member who only watches", () => {
    saleroom = { status: "live", currentLotId: "lot-2" };
    const bidder = renderBar({ deliveryMode: "hybrid", saleroomLotRefs: LOTS });
    expect(screen.getByRole("link", { name: "Bid now" })).toHaveAttribute(
      "href",
      "/lot/harbour/lot-2",
    );
    expect(tabBar()).toHaveAttribute("data-hidden-reason", "slot-claimed");
    bidder.unmount();
    renderBar({ deliveryMode: "hybrid", saleroomLotRefs: LOTS, canParticipate: false });
    expect(screen.getByRole("link", { name: "View lots" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Bid now" })).toBeNull();
  });

  it("says the auction is paused, with View lots", () => {
    saleroom = { status: "paused", currentLotId: "lot-2" };
    renderBar({ deliveryMode: "hybrid", saleroomLotRefs: LOTS });
    expect(screen.getByText(/Auction paused/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View lots" })).toBeInTheDocument();
  });
});
