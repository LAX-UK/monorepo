import { describe, expect, it } from "vitest";
import { enquiryContextLinks } from "./enquiry-detail.vm";

const artwork = {
  id: "11111111-1111-4111-8111-111111111111",
  title: "Blue Field",
  slug: "blue-field",
  thumbnailUrl: null,
};

describe("enquiryContextLinks", () => {
  it("links an artwork to its public lax.art page", () => {
    expect(
      enquiryContextLinks({ artwork, contextSlug: null, topic: "artwork" }, "https://lax.art/"),
    ).toEqual([
      { label: "Artwork", text: "Blue Field", href: "https://lax.art/artworks/blue-field" },
    ]);
  });

  it("links an exhibition enquiry to the exhibition page", () => {
    expect(
      enquiryContextLinks(
        { artwork: null, contextSlug: "summer-show", topic: "exhibition" },
        "https://lax.art",
      ),
    ).toEqual([
      { label: "Exhibition", text: "summer-show", href: "https://lax.art/exhibitions/summer-show" },
    ]);
  });

  it("shows other contexts as text rather than guessing an address", () => {
    expect(
      enquiryContextLinks(
        { artwork: null, contextSlug: "brunswick-house", topic: "private_viewing" },
        "https://lax.art",
      ),
    ).toEqual([{ label: "Page", text: "brunswick-house", href: null }]);
  });

  it("still names the context when the public address is not configured", () => {
    expect(enquiryContextLinks({ artwork, contextSlug: null, topic: "artwork" }, null)).toEqual([
      { label: "Artwork", text: "Blue Field", href: null },
    ]);
  });

  it("returns nothing for an enquiry with no context", () => {
    expect(
      enquiryContextLinks({ artwork: null, contextSlug: null, topic: "general" }, "x"),
    ).toEqual([]);
  });

  it("escapes slugs in the address", () => {
    const [link] = enquiryContextLinks(
      { artwork: { ...artwork, slug: "a b/c" }, contextSlug: null, topic: "artwork" },
      "https://lax.art",
    );
    expect(link?.href).toBe("https://lax.art/artworks/a%20b%2Fc");
  });
});
