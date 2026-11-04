import {
  type ArtistDirectoryFilterRailInput,
  buildArtistDirectoryFilterGroups,
} from "@/lib/artists/directory-filter-rail";
import { ARTIST_DIRECTORY_PRESETS } from "@/lib/artists/directory-presets";
import type { PublicArtistDirectoryFacets } from "@auction/types";
import { describe, expect, it } from "vitest";

const facets: PublicArtistDirectoryFacets = {
  total: 10,
  featured: 2,
  living: 6,
  historical: 4,
  byKind: { artist: 7, maker: 3 },
  hasUpcoming: 5,
  topNationalities: [],
  topCategories: [{ id: "c1", name: "Prints", slug: "prints", count: 4 }],
  topDecades: [{ key: "1960s", label: "1960s", count: 2 }],
  letters: [],
};

const preset = ARTIST_DIRECTORY_PRESETS.find((p) => p.id === "all");
if (!preset) throw new Error("missing preset");

const input: ArtistDirectoryFilterRailInput = {
  preset,
  searchParams: {},
  layoutView: "grid",
  facets,
  carry: {},
  nationalityIsLocked: false,
  decadeIsLocked: false,
  hasUpcoming: false,
};

describe("buildArtistDirectoryFilterGroups", () => {
  it("titles the rail groups in plain words", () => {
    const titles = buildArtistDirectoryFilterGroups(input).map((g) => g.title);
    expect(titles).toEqual([
      "Show",
      "Living or historical",
      "Type",
      "Has works on sale",
      "Department",
      "Born",
    ]);
  });

  it("keeps All and Featured reachable under Show", () => {
    const [group] = buildArtistDirectoryFilterGroups(input);
    expect(group?.links.map((l) => l.label)).toEqual(["All", "Featured"]);
  });

  it("offers Living and Historical under Living or historical", () => {
    const group = buildArtistDirectoryFilterGroups(input).find((g) => g.id === "scenario");
    expect(group?.links.map((l) => l.label)).toEqual(["Living", "Historical"]);
  });

  it("words the works-on-sale toggle so it does not repeat its group title", () => {
    const group = buildArtistDirectoryFilterGroups(input).find((g) => g.id === "lots");
    expect(group?.links[0]?.label).toBe("Only these artists");
  });

  it("names the page Artists and makers", () => {
    expect(preset.heroTitle).toBe("Artists and makers");
  });
});
