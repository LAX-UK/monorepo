import type { PublicArtworkSummary } from "@auction/shop-contracts";

/** A Shop edition on sale, as the public catalogue returns it; override what a test is about. */
export function artworkSummary(
  overrides: Partial<PublicArtworkSummary> = {},
): PublicArtworkSummary {
  return {
    slug: "harbour-light",
    title: "Harbour light",
    artistName: "Mara Ellison",
    artistSlug: "mara-ellison",
    imageUrl: "/harbour-light.webp",
    saleState: "for_sale",
    dimensions: null,
    medium: "Giclée print",
    yearCreated: 2026,
    salesChannel: "shop",
    eligibleForEditionAllocation: true,
    printPricePence: 34000,
    availability: { totalEditions: 50, state: "available" },
    listedAt: "2026-10-01T09:00:00.000Z",
    ...overrides,
  };
}
