import { describe, expect, it } from "vitest";
import * as legacyBarrel from "./artwork-view-models";
import * as viewModels from "./view-models";

const EXPECTED_EXPORT_KEYS = [
  "ARTWORK_PAGE_ACCORDION_IDS",
  "aboutArtistBlockContent",
  "findUserLatestBidMeta",
  "formatExhibitions",
  "formatProvenanceList",
  "mapAuctionSessionHeaderVM",
  "mapBidHistoryToFeedEntries",
  "mapLotToAccordionBlocks",
  "mapLotToHeroVM",
  "mapLotToSummarySeed",
  "mapSaleLotsToQueueVMs",
  "mapSaleLotsToSaleroomQueueVMs",
  "mapSiblingsToRailVM",
  "mapUserBidsHistoryVM",
  "maskPaddleFromBidderId",
  "splitArtworkAccordionBlocks",
] as const;

describe("artwork view-models characterization", () => {
  it("legacy barrel and view-models index expose the same export key set", () => {
    const legacyKeys = Object.keys(legacyBarrel).sort();
    const moduleKeys = Object.keys(viewModels).sort();
    expect(legacyKeys).toEqual(moduleKeys);
  });

  it("exports a stable public API key set", () => {
    expect([...Object.keys(legacyBarrel)].sort()).toEqual([...EXPECTED_EXPORT_KEYS].sort());
  });

  it("re-exports hero mapper unchanged from components barrel", async () => {
    const fromComponents = await import("@/components/sections/artwork/artwork-view-models");
    expect(fromComponents.mapLotToHeroVM).toBe(legacyBarrel.mapLotToHeroVM);
    expect(fromComponents.maskPaddleFromBidderId).toBe(legacyBarrel.maskPaddleFromBidderId);
  });
});
