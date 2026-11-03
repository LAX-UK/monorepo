import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { CatalogueArtist, CatalogueProduct } from "../catalogue-product.js";
import { toCatalogueArtist, toCatalogueProduct } from "../to-catalogue-product.js";

const dir = dirname(fileURLToPath(import.meta.url));

type CoqlFixture = { data: Record<string, unknown>[]; info: { more_records: boolean } };

function load(name: string): CoqlFixture {
  return JSON.parse(readFileSync(join(dir, name), "utf8")) as CoqlFixture;
}

/** Rows as Zoho's COQL endpoint returns them (recorded shape; no live call was made). */
export const productRows = (): Record<string, unknown>[] => load("coql-products.json").data;
export const artistRows = (): Record<string, unknown>[] => load("coql-artists.json").data;

export function artistDirectory(): Map<string, CatalogueArtist> {
  const map = new Map<string, CatalogueArtist>();
  for (const row of artistRows()) {
    const artist = toCatalogueArtist(row);
    if (artist) map.set(artist.id, artist);
  }
  return map;
}

/** The fixture Products by their last digit, for example `product(1)`. */
export function product(n: number): CatalogueProduct {
  const row = productRows().find((r) => String(r.id).endsWith(`100000${n}`));
  const mapped = row ? toCatalogueProduct(row, artistDirectory()) : null;
  if (!mapped) throw new Error(`no fixture product ${n}`);
  return mapped;
}
