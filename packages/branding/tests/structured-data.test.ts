import { describe, expect, it } from "vitest";
import {
  breadcrumbJsonLd,
  jsonLdScript,
  localBusinessJsonLd,
  organizationJsonLd,
  websiteJsonLd,
} from "../src/structured-data.js";

describe("structured data builders", () => {
  it("escapes markup and wraps multiple items in an array", () => {
    expect(jsonLdScript({ name: "</script>" })).toBe('{"name":"\\u003c/script>"}');
    expect(JSON.parse(jsonLdScript({ a: 1 }, null, { b: 2 }))).toEqual([{ a: 1 }, { b: 2 }]);
    expect(jsonLdScript()).toBe("{}");
  });

  it("omits optional organisation fields that are not supplied", () => {
    expect(organizationJsonLd({ name: "LAX Art", url: "https://www.thelax.art" })).toEqual({
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "LAX Art",
      url: "https://www.thelax.art",
    });
  });

  it("builds a gallery with address and opening hours", () => {
    const gallery = localBusinessJsonLd({
      type: "ArtGallery",
      name: "LAX Art",
      url: "https://www.thelax.art",
      address: {
        streetAddress: "156 New Cavendish Street",
        addressLocality: "London",
        postalCode: "W1W 6YW",
        addressCountry: "GB",
      },
      openingHours: { dayOfWeek: ["Monday"], opens: "10:00", closes: "18:00" },
    });
    expect(gallery).toMatchObject({
      "@type": "ArtGallery",
      address: { "@type": "PostalAddress", postalCode: "W1W 6YW" },
      openingHoursSpecification: { "@type": "OpeningHoursSpecification", opens: "10:00" },
    });
  });

  it("adds a search action only when a template is given", () => {
    const base = { name: "LAX Art", url: "https://www.thelax.art" };
    expect(websiteJsonLd(base)).not.toHaveProperty("potentialAction");
    expect(
      websiteJsonLd({ ...base, searchUrlTemplate: `${base.url}/artworks?q={search_term_string}` }),
    ).toMatchObject({
      potentialAction: {
        target: { urlTemplate: "https://www.thelax.art/artworks?q={search_term_string}" },
      },
    });
  });

  it("resolves breadcrumb paths against the base URL", () => {
    expect(
      breadcrumbJsonLd("https://www.thelax.art", [
        { name: "Artworks", path: "/artworks" },
        { name: "Bloom", path: "artworks/bloom" },
      ]).itemListElement,
    ).toEqual([
      {
        "@type": "ListItem",
        position: 1,
        name: "Artworks",
        item: "https://www.thelax.art/artworks",
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Bloom",
        item: "https://www.thelax.art/artworks/bloom",
      },
    ]);
  });
});
