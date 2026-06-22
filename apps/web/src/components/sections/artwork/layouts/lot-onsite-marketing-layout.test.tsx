import type {
  AccordionBlock,
  LotRelatedRailVM,
  LotSummarySeedVM,
} from "@/components/sections/artwork/artwork-view-models";
import {
  mapAuctionSessionHeaderVM,
  mapSaleLotsToQueueVMs,
} from "@/components/sections/artwork/artwork-view-models";
import { LotOnsiteMarketingLayout } from "@/components/sections/artwork/layouts/lot-onsite-marketing-layout";
import { mapSaleToOverviewVM } from "@/components/sections/saleroom/mappers";
import type { Lot, Sale } from "@auction/types";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/time/use-client-clock", () => ({
  useClientClock: () => Date.parse("2026-06-01T12:00:00.000Z"),
}));

vi.mock("@/hooks/use-reduced-motion", () => ({
  useReducedMotion: () => false,
}));

const now = new Date("2026-06-01T12:00:00.000Z");

const baseLot: Lot = {
  id: "lot-x",
  saleId: "sale-x",
  lotNumber: 1,
  sellerLegalEntityId: "le-x",
  title: "Study in Blue",
  description: null,
  medium: "Oil",
  dimensions: null,
  images: ["/img.jpg"],
  categoryId: "c",
  auctionType: "english",
  startingPrice: "500",
  reservePrice: null,
  buyNowPrice: null,
  currentPrice: "500",
  buyerPremiumRate: "0.25",
  minBidIncrement: "50",
  dutchDecrementAmount: null,
  dutchDecrementIntervalMs: 0,
  dutchLastDecrementAt: null,
  startTime: new Date(now.getTime() + 86_400_000),
  endTime: new Date(now.getTime() + 172_800_000),
  status: "scheduled",
  winnerId: null,
  createdAt: now,
  updatedAt: now,
  marketingDetails: {},
};

const baseSale: Sale = {
  id: "sale-x",
  title: "Evening Sale",
  description: null,
  coverImages: [],
  categoryId: null,
  deliveryMode: "onsite",
  allowOnlineBidsBeforeGoLive: false,
  streamUrl: null,
  locationName: "London Gallery",
  locationAddress: null,
  locationMapUrl: null,
  locationAddressLine1: "1 Test Street",
  locationAddressLine2: null,
  locationCity: "London",
  locationCounty: null,
  locationPostcode: "W1 1AA",
  locationCountry: "United Kingdom",
  status: "scheduled",
  startTime: new Date(now.getTime() + 86_400_000),
  endTime: new Date(now.getTime() + 172_800_000),
  previewStartTime: new Date(now.getTime() + 43_200_000),
  buyerPremiumRate: "0.25",
  buyerPremiumTiers: null,
  terms: null,
  createdAt: now,
  updatedAt: now,
};

const summarySeed: LotSummarySeedVM = {
  title: baseLot.title,
  kicker: null,
  estimateLine: "£500 – £800 GBP",
  sellerName: "Seller",
  sellerHref: "/artist/s/s",
  sellerImageUrl: null,
};

const rail: LotRelatedRailVM = { mode: "sale", heading: "", viewAuctionHref: null, cards: [] };
const blocks: AccordionBlock[] = [
  {
    id: "lot-details",
    title: "Lot details",
    content: "Catalogue and reserve copy.",
    hidden: false,
  },
];
const queueVMs = mapSaleLotsToQueueVMs(baseLot, [baseLot], () => "Seller");
const overview = mapSaleToOverviewVM(baseSale, { categoryLabel: null });

function renderLayout(sale: Sale = baseSale) {
  return render(
    <LotOnsiteMarketingLayout
      auction={baseLot}
      sale={sale}
      summarySeed={summarySeed}
      marketingAccordionBlocks={blocks}
      rail={rail}
      isAuthenticated={false}
      watchedLotIds={[]}
      currentUserId={null}
      shareUrl="https://example.com/lot"
      followSlot={<span>follow</span>}
      sessionHeader={mapAuctionSessionHeaderVM({
        saleTitle: sale.title,
        lot: baseLot,
      })}
      queueCurrent={queueVMs.current}
      queueUpNext={queueVMs.upNext}
      queueRest={queueVMs.queue}
      saleForLifecycle={{ status: sale.status, deliveryMode: sale.deliveryMode }}
      overview={overview}
    />,
  );
}

describe("LotOnsiteMarketingLayout", () => {
  it("renders plan your visit and venue", () => {
    renderLayout();
    expect(screen.getByRole("heading", { name: /Plan your visit/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Saleroom Venue/i })).toBeInTheDocument();
  });

  it("shows seller as a link when sellerHref is set", () => {
    renderLayout();
    expect(screen.getByRole("link", { name: "Seller" })).toHaveAttribute("href", "/artist/s/s");
  });

  it("shows sale-specific preview hours when previewStartTime is set", () => {
    renderLayout();
    expect(screen.getByText(/until session opens/i)).toBeInTheDocument();
    expect(screen.queryByText(/Weekdays, 09:00/i)).not.toBeInTheDocument();
  });

  it("shows live stream section when scheduled and streamUrl is set", () => {
    const sale = {
      ...baseSale,
      status: "scheduled" as const,
      streamUrl: "https://example.com/watch",
    };
    renderLayout(sale);
    expect(screen.getByRole("heading", { name: /Live stream/i })).toBeInTheDocument();
  });

  it("shows Watch live CTA in hero when scheduled and streamUrl is set", () => {
    const sale = {
      ...baseSale,
      status: "scheduled" as const,
      streamUrl: "https://example.com/watch",
    };
    renderLayout(sale);
    expect(screen.getByRole("link", { name: /Watch live stream/i })).toBeInTheDocument();
  });

  it("shows embed preview for YouTube stream URLs when scheduled", () => {
    const sale = {
      ...baseSale,
      status: "scheduled" as const,
      streamUrl: "https://www.youtube.com/watch?v=jNQXAC9IVRw",
    };
    renderLayout(sale);
    expect(screen.getByRole("button", { name: /watch live/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /open in youtube/i })).toBeInTheDocument();
  });

  it("hides stream section and hero CTA when sale has ended", () => {
    const sale = {
      ...baseSale,
      status: "ended" as const,
      streamUrl: "https://www.youtube.com/watch?v=jNQXAC9IVRw",
    };
    renderLayout(sale);
    expect(screen.queryByRole("heading", { name: /Live stream/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Watch live stream/i })).not.toBeInTheDocument();
  });

  it("shows plan your visit without onsite bid form triggers", () => {
    renderLayout();
    expect(screen.getByRole("heading", { name: /Plan your visit/i })).toBeInTheDocument();
    expect(screen.getByText(/not through the website/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Submit Bid Form/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Request Line/i })).not.toBeInTheDocument();
  });

  it("shows lot details where the participation hub used to render", () => {
    renderLayout();
    expect(screen.getByRole("heading", { name: "LOT DETAILS" })).toBeInTheDocument();
    expect(screen.getByText(/Catalogue and reserve copy/i)).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "In-Person Event Participation Hub" }),
    ).not.toBeInTheDocument();
  });
});
