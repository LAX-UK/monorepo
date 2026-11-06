import { describe, expect, it } from "vitest";
import {
  artworkOption,
  editionLabel,
  editionListingLabel,
  editionOption,
  ownedArtworkOptions,
  partyOption,
} from "./lookup-options.vm";

describe("picker options read by name, never by id", () => {
  it("shows a person by name with their email, which tells two of the same name apart", () => {
    expect(
      partyOption({
        partyId: "p1",
        displayName: "Ada Lovelace",
        kind: "person",
        email: "ada@example.com",
      }),
    ).toEqual({ id: "p1", label: "Ada Lovelace", description: "ada@example.com", meta: "Person" });
  });

  it("falls back to the kind of party when there is no email", () => {
    expect(
      partyOption({
        partyId: "p2",
        displayName: "Cavendish Gallery",
        kind: "gallery",
        email: null,
      }),
    ).toEqual({ id: "p2", label: "Cavendish Gallery", description: "Gallery" });
  });

  it("shows an artwork with its artist", () => {
    expect(
      artworkOption({ artworkId: "a1", title: "Vessel Study", artistName: "Theo Marsh" }),
    ).toEqual({ id: "a1", label: "Vessel Study", description: "Theo Marsh" });
  });

  it("shows an edition as the work and its print label, with the artist and status", () => {
    const option = editionOption({
      editionId: "e2",
      artworkId: "a1",
      artworkTitle: "Vessel Study",
      artistName: "Theo Marsh",
      printLabel: "2/24",
      listingStatus: "authorised",
    });
    expect(option).toEqual({
      id: "e2",
      label: "Vessel Study, 2/24",
      description: "Theo Marsh",
      meta: "Available",
    });
    expect(editionLabel({ artworkTitle: "Open study", printLabel: "OE-0021" })).toBe(
      "Open study, OE-0021",
    );
  });

  it("words every listing status", () => {
    expect(editionListingLabel("not_authorised")).toBe("Not authorised");
    expect(editionListingLabel("something_new")).toBe("something new");
  });
});

describe("ownedArtworkOptions", () => {
  const edition = (artworkId: string, artworkTitle: string, printLabel: string) => ({
    editionId: `${artworkId}-${printLabel}`,
    artworkId,
    artworkTitle,
    artworkSlug: artworkTitle.toLowerCase().replaceAll(" ", "-"),
    printLabel,
    listingStatus: "authorised",
    custodyStatus: "stored",
  });

  it("offers an artwork once however many editions of it the client holds", () => {
    const options = ownedArtworkOptions([
      edition("a1", "Vessel Study", "1/24"),
      edition("a2", "Night Garden", "OE-0007"),
      edition("a1", "Vessel Study", "2/24"),
    ]);
    expect(options).toEqual([
      { id: "a1", label: "Vessel Study", description: "Holds prints 1/24, 2/24" },
      { id: "a2", label: "Night Garden", description: "Holds print OE-0007" },
    ]);
  });

  it("offers nothing for a client with no editions", () => {
    expect(ownedArtworkOptions([])).toEqual([]);
  });
});
