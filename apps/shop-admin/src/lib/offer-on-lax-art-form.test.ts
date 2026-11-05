import { describe, expect, it } from "vitest";
import {
  offerConflictField,
  offerOnLaxArtBody,
  offerOnLaxArtErrorSummary,
  offerOnLaxArtForm,
  problemsTitle,
  suggestedSlug,
  validateOfferOnLaxArtForm,
  withArtist,
} from "./offer-on-lax-art-form";

const MATCHED = { artistId: "3f0b6d7e-0000-4000-8000-000000000002", displayName: "Ada Rowe" };

describe("offerOnLaxArtForm", () => {
  it("starts from the artist matched by Zoho artist code, selling by enquiry", () => {
    expect(
      offerOnLaxArtForm({
        matchedArtist: MATCHED,
        zohoArtistName: "Ada Rowe",
        title: "Tidal margin IV",
      }),
    ).toEqual({
      artistId: MATCHED.artistId,
      artistName: "Ada Rowe",
      saleState: "for_sale",
      slug: "ada-rowe-tidal-margin-iv",
      slugEdited: false,
    });
  });

  it("asks for an artist when none matched, but still suggests an address from Zoho's name", () => {
    const form = offerOnLaxArtForm({
      matchedArtist: null,
      zohoArtistName: "Ada Rowe",
      title: "Tidal margin IV",
    });
    expect(form.artistId).toBeNull();
    expect(form.slug).toBe("ada-rowe-tidal-margin-iv");
  });
});

describe("suggestedSlug", () => {
  it("joins artist and title, drops accents and punctuation", () => {
    expect(suggestedSlug("Zoë Núñez", "Untitled (No. 3)")).toBe("zoe-nunez-untitled-no-3");
  });

  it("works without an artist", () => {
    expect(suggestedSlug(null, "Tidal margin IV")).toBe("tidal-margin-iv");
  });
});

describe("withArtist", () => {
  const form = offerOnLaxArtForm({
    matchedArtist: null,
    zohoArtistName: "A. Rowe",
    title: "Tidal margin IV",
  });

  it("moves the suggested address with the chosen artist", () => {
    const next = withArtist(form, { id: MATCHED.artistId, label: "Ada Rowe" }, "Tidal margin IV");
    expect(next).toMatchObject({ artistId: MATCHED.artistId, slug: "ada-rowe-tidal-margin-iv" });
  });

  it("leaves an address staff edited by hand alone", () => {
    const edited = { ...form, slug: "my-own-address", slugEdited: true };
    expect(withArtist(edited, { id: "x", label: "Ada Rowe" }, "Tidal margin IV").slug).toBe(
      "my-own-address",
    );
  });
});

describe("validateOfferOnLaxArtForm", () => {
  const ready = offerOnLaxArtForm({
    matchedArtist: MATCHED,
    zohoArtistName: "Ada Rowe",
    title: "Tidal margin IV",
  });

  it("passes a prefilled form", () => {
    expect(validateOfferOnLaxArtForm(ready, "Ada Rowe")).toEqual({});
  });

  it("names the Zoho artist when none is chosen", () => {
    expect(validateOfferOnLaxArtForm({ ...ready, artistId: null }, "Ada Rowe")).toEqual({
      artistId: "Choose the lax.art artist for Ada Rowe.",
    });
  });

  it.each([
    ["empty", "", "Enter a web address."],
    [
      "spaced",
      "ada rowe",
      "Use lower case words joined by hyphens, such as ada-rowe-tidal-margin-iv.",
    ],
    [
      "upper case",
      "Ada-Rowe",
      "Use lower case words joined by hyphens, such as ada-rowe-tidal-margin-iv.",
    ],
  ])("refuses a %s web address", (_name, slug, message) => {
    expect(validateOfferOnLaxArtForm({ ...ready, slug }, "Ada Rowe").slug).toBe(message);
  });

  it("lists errors in page order for the summary", () => {
    const errors = validateOfferOnLaxArtForm({ ...ready, artistId: null, slug: "" }, "Ada Rowe");
    expect(offerOnLaxArtErrorSummary(errors)).toEqual([
      { fieldId: "offer-lax-art-artistId", message: "Choose the lax.art artist for Ada Rowe." },
      { fieldId: "offer-lax-art-slug", message: "Enter a web address." },
    ]);
  });
});

describe("request and refusal", () => {
  it("builds the body with a trimmed address", () => {
    const form = {
      ...offerOnLaxArtForm({ matchedArtist: MATCHED, zohoArtistName: "A", title: "T" }),
      saleState: "price_on_application" as const,
      slug: " ada-rowe-t ",
    };
    expect(offerOnLaxArtBody(form)).toEqual({
      artistId: MATCHED.artistId,
      saleState: "price_on_application",
      slug: "ada-rowe-t",
    });
  });

  it("builds no body without an artist", () => {
    expect(
      offerOnLaxArtBody(
        offerOnLaxArtForm({ matchedArtist: null, zohoArtistName: "A", title: "T" }),
      ),
    ).toBeNull();
  });

  it("puts only the taken-address refusal on the web address field", () => {
    expect(offerConflictField("That slug is already used by another artwork.")).toBe("slug");
    expect(offerConflictField("This artwork is in a private sale.")).toBeNull();
  });

  it("says how many problems there are", () => {
    expect(problemsTitle(1)).toBe("There is a problem");
    expect(problemsTitle(2)).toBe("There are 2 problems");
  });
});
