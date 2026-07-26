import type { ArtistProfile } from "@auction/types";
import { describe, expect, it } from "vitest";
import { buildArtistOverviewViewModel } from "./artist-overview.vm";

const artist = {
  id: "art_1",
  displayName: "Jane Doe",
  kind: "individual",
  status: "approved",
  verified: true,
  featured: false,
  archived: false,
  categories: [{ id: "cat_1", name: "Paintings" }],
} as unknown as ArtistProfile;

describe("buildArtistOverviewViewModel", () => {
  it("maps lot and duplicate counts into summary and KPI tiles", () => {
    const vm = buildArtistOverviewViewModel("art_1", artist, 7, 2, 30);

    expect(vm.summaryItems.some((item) => item.id === "lots" && item.value === 7)).toBe(true);
    expect(vm.kpiTiles[0]?.value).toBe("7");
    expect(vm.kpiTiles[1]?.value).toBe("2");
    expect(vm.kpiTiles[2]?.value).toBe("1");
  });
});
