import type { Lot, ArtistProfile as RegistryArtist } from "@auction/types";
import { describe, expect, it } from "vitest";
import { buildArtistPageVM } from "./artist-page.vm";

const registry = {
  id: "artist-1",
  displayName: "Henry Lisle",
  kind: "artist",
  nationality: "British",
  birthYear: "1860",
  deathYear: "1938",
  categories: [],
  attributes: {},
} as unknown as RegistryArtist;

const lot = (id: string, status: string, winnerId: string | null = null) =>
  ({ id, status, winnerId }) as unknown as Lot;

function build(lots: Lot[], searchParams: Record<string, string> = {}, session = null) {
  return buildArtistPageVM({
    id: "artist-1",
    slug: "henry-lisle",
    searchParams,
    artistLots: lots,
    registry,
    aliases: [],
    session,
    watchedArtistIds: [],
    relatedRows: [],
  });
}

describe("buildArtistPageVM works", () => {
  it("has no works and opens on sale for an artist with no lots", () => {
    const vm = build([]);
    expect(vm.works).toEqual({ onSale: [], results: [] });
    expect(vm.activeWorksTab).toBe("on-sale");
  });

  it("splits lots and opens the results tab from the address", () => {
    const vm = build([lot("a", "active"), lot("b", "ended", "buyer")], { tab: "results" });
    expect(vm.works.onSale.map((l) => l.id)).toEqual(["a"]);
    expect(vm.works.results.map((l) => l.id)).toEqual(["b"]);
    expect(vm.activeWorksTab).toBe("results");
  });

  it("reports a visitor as signed out and not following", () => {
    const vm = build([]);
    expect(vm.isAuthed).toBe(false);
    expect(vm.watching).toBe(false);
  });
});
