import type { CrmCoqlQuery } from "../../crm/crm-gateway.js";
import type { CatalogueArtist, CatalogueProduct } from "./catalogue-product.js";
import {
  COQL_PAGE_SIZE,
  artistsQuery,
  productByIdQuery,
  productsModifiedSinceQuery,
} from "./coql.js";
import { toCatalogueArtist, toCatalogueProduct } from "./to-catalogue-product.js";

/** Reads the artwork catalogue from Zoho. The sync depends on this, never on Zoho's API. */
export interface ZohoCatalogueReader {
  /** One Product by Zoho id, or null when Zoho no longer has it. */
  fetchProduct(id: string): Promise<CatalogueProduct | null>;
  /** Pages of Products changed after a time, oldest first; null reads every Product. */
  fetchModifiedSince(since: Date | null): AsyncGenerator<CatalogueProduct[]>;
}

/** Zoho refuses offsets beyond this, so a longer read restarts from the last time it reached. */
const MAX_COQL_OFFSET = 2_000;

/** Reads Products and Artists with COQL through the existing Zoho gateway. */
export class CoqlZohoCatalogueReader implements ZohoCatalogueReader {
  constructor(private readonly coql: CrmCoqlQuery) {}

  async fetchProduct(id: string): Promise<CatalogueProduct | null> {
    const artists = await this.loadArtists();
    const page = await this.coql.queryCoql(productByIdQuery(id));
    const row = page.rows[0];
    return row ? toCatalogueProduct(row, artists) : null;
  }

  async *fetchModifiedSince(since: Date | null): AsyncGenerator<CatalogueProduct[]> {
    const artists = await this.loadArtists();
    const seen = new Set<string>();
    let from = since;
    let offset = 0;

    for (;;) {
      const page = await this.coql.queryCoql(productsModifiedSinceQuery(from, offset));
      const products: CatalogueProduct[] = [];
      for (const row of page.rows) {
        const product = toCatalogueProduct(row, artists);
        if (!product || seen.has(product.id)) continue;
        seen.add(product.id);
        products.push(product);
      }
      if (products.length > 0) yield products;

      if (!page.moreRecords) return;
      offset += COQL_PAGE_SIZE;
      if (offset < MAX_COQL_OFFSET) continue;

      const reached = lastModifiedAt(page.rows, artists);
      if (!reached || (from && reached.getTime() <= from.getTime())) {
        throw new Error("zoho_catalogue_read_cannot_advance");
      }
      // Start again one second before the last time reached; Products already read are skipped.
      from = new Date(reached.getTime() - 1_000);
      offset = 0;
    }
  }

  private async loadArtists(): Promise<Map<string, CatalogueArtist>> {
    const artists = new Map<string, CatalogueArtist>();
    for (let offset = 0; ; offset += COQL_PAGE_SIZE) {
      const page = await this.coql.queryCoql(artistsQuery(offset));
      for (const row of page.rows) {
        const artist = toCatalogueArtist(row);
        if (artist) artists.set(artist.id, artist);
      }
      if (!page.moreRecords || offset + COQL_PAGE_SIZE >= MAX_COQL_OFFSET) return artists;
    }
  }
}

function lastModifiedAt(
  rows: Record<string, unknown>[],
  artists: ReadonlyMap<string, CatalogueArtist>,
): Date | null {
  for (let i = rows.length - 1; i >= 0; i--) {
    const row = rows[i];
    const product = row ? toCatalogueProduct(row, artists) : null;
    if (product?.modifiedAt) return product.modifiedAt;
  }
  return null;
}
