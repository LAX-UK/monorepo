import type { Lot } from "@auction/types";
import { describe, expect, it } from "vitest";
import {
  ARTWORK_PAGE_ACCORDION_IDS,
  mapLotToHeroVM,
  maskPaddleFromBidderId,
  splitArtworkAccordionBlocks,
} from "./artwork-view-models";

function makeLot(overrides: Partial<Lot> = {}): Lot {
  return {
    id: "lot-aaa-bbbb-cccc",
    title: "Blue period study",
    saleId: "sale-1",
    lotNumber: 3,
    status: "active",
    currentPrice: "500",
    images: [],
    marketingDetails: { estimate: null },
    sellerId: "seller-1",
    sellerLegalEntityId: "le-1",
    startTime: new Date(),
    endTime: new Date(),
    auctionType: "english",
    startingPrice: "100",
    ...overrides,
  } as Lot;
}

describe("mapLotToHeroVM", () => {
  it("returns sale navigation when parent sale and siblings exist", () => {
    const lot = makeLot();
    const siblings = [
      makeLot({ id: "lot-1", lotNumber: 1 }),
      lot,
      makeLot({ id: "lot-2", lotNumber: 5 }),
    ];
    const vm = mapLotToHeroVM(lot, { id: "sale-1", title: "Modern Art" }, siblings);

    expect(vm.saleTitle).toBe("Modern Art");
    expect(vm.lotNumberLabel).toBe("LOT 3");
    expect(vm.positionLabel).toBe("2 / 3");
    expect(vm.prevHref).toContain("lot-1");
    expect(vm.nextHref).toContain("lot-2");
    expect(vm.homeSegment).toEqual({ label: "Home", href: "/" });
  });

  it("returns minimal hero when sale context is missing", () => {
    const lot = makeLot({ saleId: null, lotNumber: 7 });
    const vm = mapLotToHeroVM(lot, null, null);

    expect(vm.saleHref).toBeNull();
    expect(vm.lotNumberLabel).toBe("LOT 7");
    expect(vm.prevHref).toBeNull();
    expect(vm.nextHref).toBeNull();
  });
});

describe("maskPaddleFromBidderId", () => {
  it("masks bidder id to paddle label", () => {
    expect(maskPaddleFromBidderId("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee")).toMatch(/^Paddle#•••/);
  });
});

describe("splitArtworkAccordionBlocks", () => {
  it("separates lot details from collapsible blocks", () => {
    const blocks = [
      { id: ARTWORK_PAGE_ACCORDION_IDS.lotDetails, title: "Details", hidden: false },
      { id: ARTWORK_PAGE_ACCORDION_IDS.fees, title: "Fees", hidden: false },
      { id: "hidden-block", title: "Hidden", hidden: true },
    ];
    const { lotDetails, accordionBlocks } = splitArtworkAccordionBlocks(blocks);

    expect(lotDetails?.id).toBe(ARTWORK_PAGE_ACCORDION_IDS.lotDetails);
    expect(accordionBlocks).toHaveLength(1);
    expect(accordionBlocks[0]?.id).toBe(ARTWORK_PAGE_ACCORDION_IDS.fees);
  });
});
