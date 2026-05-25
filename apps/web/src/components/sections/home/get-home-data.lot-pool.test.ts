import {
  buildHomeCatalogLotPool,
  pickHomeLowerStripCandidates,
  pickPrivateSaleHighlightLots,
} from "@/components/sections/home/get-home-data.lot-pool";
import type { HomeUrgencySection } from "@/components/sections/home/get-home-data.types";
import { toEndingSoonLotCardVMs } from "@/components/sections/home/home-view-models";
import type { Lot } from "@auction/types";
import { describe, expect, it } from "vitest";

const baseLot = (overrides: Partial<Lot> = {}): Lot => ({
  id: "lot-1",
  saleId: null,
  lotNumber: 1,
  title: "Test lot",
  description: null,
  medium: null,
  dimensions: null,
  images: [],
  categoryId: "c",
  auctionType: "english",
  startingPrice: "100",
  reservePrice: null,
  buyNowPrice: null,
  currentPrice: "200",
  buyerPremiumRate: "0.25",
  minBidIncrement: "10",
  dutchDecrementAmount: null,
  dutchDecrementIntervalMs: 0,
  dutchLastDecrementAt: null,
  startTime: new Date("2026-01-01T12:00:00.000Z"),
  endTime: new Date("2026-01-02T12:00:00.000Z"),
  status: "active",
  winnerId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  marketingDetails: {},
  ...overrides,
});

describe("buildHomeCatalogLotPool", () => {
  it("merges active then scheduled and dedupes by id", () => {
    const active = [baseLot({ id: "a" }), baseLot({ id: "b" })];
    const scheduled = [
      baseLot({ id: "b", status: "scheduled" }),
      baseLot({ id: "c", status: "scheduled" }),
    ];
    expect(buildHomeCatalogLotPool(active, scheduled).map((l) => l.id)).toEqual(["a", "b", "c"]);
  });
});

describe("pickHomeLowerStripCandidates", () => {
  it("keeps scheduled lots when hero is rotator and active pool is a single lot", () => {
    const active = [baseLot({ id: "active-only", status: "active" })];
    const scheduled = [
      baseLot({ id: "sched-1", status: "scheduled" }),
      baseLot({ id: "sched-2", status: "scheduled" }),
    ];
    const pool = buildHomeCatalogLotPool(active, scheduled);
    const urgencySection: HomeUrgencySection = {
      variant: "upcoming",
      lots: toEndingSoonLotCardVMs(scheduled),
    };

    const picked = pickHomeLowerStripCandidates({
      pool,
      heroState: {
        kind: "rotator",
        slides: [
          {
            id: "sale-1",
            href: "/sales/sale-1",
            title: "Sale",
            dateLabel: "Jan 2026",
            coverImageUrl: null,
            coverImageAlt: "Sale",
            modeBadge: "Online",
          },
        ],
      },
      urgencySection,
    });

    expect(picked.map((l) => l.id)).toEqual(["active-only", "sched-1", "sched-2"]);
  });

  it("relaxes ending-soon exclusions when a thin live catalogue would otherwise be empty", () => {
    const endingSoonEnd = new Date("2026-01-02T06:00:00.000Z");
    const lots = [
      baseLot({ id: "hero", endTime: endingSoonEnd, status: "active" }),
      baseLot({ id: "es-1", endTime: endingSoonEnd, status: "active" }),
      baseLot({ id: "es-2", endTime: endingSoonEnd, status: "active" }),
      baseLot({ id: "es-3", endTime: endingSoonEnd, status: "active" }),
      baseLot({ id: "es-4", endTime: endingSoonEnd, status: "active" }),
    ];
    const urgencyLots = lots.slice(1);
    const urgencySection: HomeUrgencySection = {
      variant: "endingSoon",
      lots: toEndingSoonLotCardVMs(urgencyLots),
    };

    const picked = pickHomeLowerStripCandidates({
      pool: lots,
      heroState: {
        kind: "fallbackLot",
        lot: {
          id: "hero",
          href: "/lots/hero",
          title: "Hero lot",
          artistName: "Artist",
          priceLabel: "Estimate",
          priceFormatted: "£1",
          currentBidFormatted: "£1",
          bidCountDisplay: "—",
          heroImageUrl: null,
          imageAlt: "Hero",
          auctionDateLabel: "Live",
          saleMetaLine: "Sale",
          featuredHeading: "Featured",
          lotLabel: "Lot 1",
          isAuctionLive: true,
        },
      },
      urgencySection,
    });

    expect(picked.length).toBeGreaterThan(0);
    expect(picked.map((l) => l.id)).toEqual(["es-1", "es-2", "es-3", "es-4"]);
  });

  it("excludes ending-soon urgency lots when enough catalogue depth remains", () => {
    const farEnd = new Date("2026-01-10T12:00:00.000Z");
    const soonEnd = new Date("2026-01-02T06:00:00.000Z");
    const endingSoonLots = [
      baseLot({ id: "es-1", endTime: soonEnd, status: "active" }),
      baseLot({ id: "es-2", endTime: soonEnd, status: "active" }),
    ];
    const remainder = [
      baseLot({ id: "pick-1", endTime: farEnd, status: "active" }),
      baseLot({ id: "pick-2", endTime: farEnd, status: "active" }),
    ];
    const pool = [...endingSoonLots, ...remainder];
    const urgencySection: HomeUrgencySection = {
      variant: "endingSoon",
      lots: toEndingSoonLotCardVMs(endingSoonLots),
    };

    const picked = pickHomeLowerStripCandidates({
      pool,
      heroState: { kind: "rotator", slides: [] },
      urgencySection,
    });

    expect(picked.map((l) => l.id)).toEqual(["pick-1", "pick-2"]);
  });

  it("excludes fallbackLot hero lot from candidates", () => {
    const lots = [
      baseLot({ id: "hero", status: "active" }),
      baseLot({ id: "other", status: "active" }),
    ];
    const picked = pickHomeLowerStripCandidates({
      pool: lots,
      heroState: {
        kind: "fallbackLot",
        lot: {
          id: "hero",
          href: "/lots/hero",
          title: "Hero lot",
          artistName: "Artist",
          priceLabel: "Estimate",
          priceFormatted: "£1",
          currentBidFormatted: "£1",
          bidCountDisplay: "—",
          heroImageUrl: null,
          imageAlt: "Hero",
          auctionDateLabel: "Live",
          saleMetaLine: "Sale",
          featuredHeading: "Featured",
          lotLabel: "Lot 1",
          isAuctionLive: true,
        },
      },
      urgencySection: { variant: "none", lots: [] },
    });

    expect(picked.map((l) => l.id)).toEqual(["other"]);
  });
});

describe("pickPrivateSaleHighlightLots", () => {
  it("uses offset slice when pool is deep enough", () => {
    const lots = Array.from({ length: 15 }, (_, i) => baseLot({ id: `lot-${i}` }));
    expect(pickPrivateSaleHighlightLots(lots).map((l) => l.id)).toEqual([
      "lot-12",
      "lot-13",
      "lot-14",
    ]);
  });
});
