import {
  type ArtworkCatalogueAvailability,
  type ArtworkCatalogueFetchInput,
  CATALOGUE_PAGE_SIZE,
} from "@/lib/catalogue/artwork-catalogue-params";
import type { CatalogueReader } from "@/lib/catalogue/catalogue-page.port";
import type { PublicArtworkSummary } from "@auction/shop-contracts";

/** The most shop-api returns in one request. */
const API_PAGE_LIMIT = 48;

export type CatalogueResults = {
  items: PublicArtworkSummary[];
  /** Every edition the filters give, across both availabilities. */
  total: number;
};

/**
 * Up to `shown` editions of one availability, read a page at a time, with that availability's
 * total. Asking for none still reads the total, so the count line is right on every page.
 */
async function readStream(
  reader: CatalogueReader,
  query: ArtworkCatalogueFetchInput,
  availability: ArtworkCatalogueAvailability,
  shown: number,
): Promise<CatalogueResults> {
  const items: PublicArtworkSummary[] = [];
  let cursor: string | undefined;
  let total: number | undefined;
  do {
    const limit = Math.max(1, Math.min(API_PAGE_LIMIT, shown - items.length));
    const page = await reader.listEditions({
      ...query,
      availability,
      limit,
      ...(cursor ? { cursor } : {}),
    });
    total ??= page.totalCount;
    items.push(...page.items.slice(0, Math.max(0, shown - items.length)));
    cursor = page.nextCursor;
  } while (cursor && items.length < shown);
  return { items, total: total ?? items.length };
}

/**
 * The catalogue's editions in the order shoppers see them: those that can be bought now first,
 * then the sold-out ones, each in the chosen sort. A shopper who filters by availability gets
 * just that one list.
 */
export async function loadCatalogueResults(
  reader: CatalogueReader,
  query: ArtworkCatalogueFetchInput,
  shown: number = CATALOGUE_PAGE_SIZE,
): Promise<CatalogueResults> {
  if (query.availability) {
    return readStream(reader, query, query.availability, shown);
  }
  // Both read at once; the sold-out list fills whatever room the available one leaves.
  const [available, soldOut] = await Promise.all([
    readStream(reader, query, "available", shown),
    readStream(reader, query, "sold_out", shown),
  ]);
  return {
    items: [...available.items, ...soldOut.items].slice(0, shown),
    total: available.total + soldOut.total,
  };
}
