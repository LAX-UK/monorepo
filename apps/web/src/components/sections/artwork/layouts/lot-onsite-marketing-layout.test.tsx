import type {
  AccordionBlock,
  LotRelatedRailVM,
  LotSummarySeedVM,
} from "@/components/sections/artwork/artwork-view-models";
import { LotOnsiteMarketingLayout } from "@/components/sections/artwork/layouts/lot-onsite-marketing-layout";
import type { Lot, Sale } from "@auction/types";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

const now = new Date();

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
  previewStartTime: null,
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

const blocks: AccordionBlock[] = [];

describe("LotOnsiteMarketingLayout", () => {
  it("renders plan your visit and venue", () => {
    render(
      <LotOnsiteMarketingLayout
        auction={baseLot}
        sale={baseSale}
        summarySeed={summarySeed}
        marketingAccordionBlocks={blocks}
        rail={rail}
        isAuthenticated={false}
        watchedLotIds={[]}
        currentUserId={null}
        shareUrl="https://example.com/lot"
        followSlot={<span>follow</span>}
      />,
    );
    expect(screen.getByRole("heading", { name: /Plan your visit/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Venue/i })).toBeInTheDocument();
  });

  it("shows live stream promo when streamUrl is set", () => {
    const sale = { ...baseSale, streamUrl: "https://example.com/watch" };
    render(
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
      />,
    );
    expect(screen.getByRole("heading", { name: /Watch from anywhere/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /open live stream/i })).toBeInTheDocument();
  });

  it("shows embed preview for YouTube stream URLs", () => {
    const sale = {
      ...baseSale,
      streamUrl: "https://www.youtube.com/watch?v=jNQXAC9IVRw",
    };
    render(
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
      />,
    );
    expect(screen.getByRole("button", { name: /watch live/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /open in youtube/i })).toBeInTheDocument();
  });
});
