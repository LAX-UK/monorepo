import type { LotQueueCardVM } from "@/components/sections/artwork/artwork-view-models";
import { describe, expect, it } from "vitest";
import { shouldShowLotQueueSidebar } from "./lot-queue-sidebar-utils";

const sampleCard = (id: string): LotQueueCardVM => ({
  id,
  href: `/lot/x/${id}`,
  imageUrl: null,
  lotNumber: 1,
  title: `Lot ${id}`,
  artistName: "Artist",
  estimateLine: null,
  currentBid: "£100",
  isCurrentLot: false,
  isUpNext: false,
});

describe("shouldShowLotQueueSidebar", () => {
  it("returns false for a single-lot sale with no siblings", () => {
    expect(shouldShowLotQueueSidebar(null, [], false)).toBe(false);
  });

  it("returns true while sale siblings are unresolved", () => {
    expect(shouldShowLotQueueSidebar(null, [], true)).toBe(true);
  });

  it("returns true when up next is present", () => {
    expect(shouldShowLotQueueSidebar(sampleCard("next"), [], false)).toBe(true);
  });

  it("returns true when queue has items", () => {
    expect(shouldShowLotQueueSidebar(null, [sampleCard("q1")], false)).toBe(true);
  });

  it("returns false when all siblings are not queue-eligible (empty queue)", () => {
    expect(shouldShowLotQueueSidebar(null, [], false)).toBe(false);
  });
});
