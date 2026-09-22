import type { ArtworkCatalogueSort } from "./artwork-catalogue-sort.js";
import {
  InvalidCatalogueCursorError,
  decodeCatalogueCursor,
  encodeCatalogueCursor,
} from "./catalogue-cursor.js";

export type ArtworkNewestCursor = {
  sort: "newest";
  createdAt: Date;
  id: string;
};

export type ArtworkTitleCursor = {
  sort: "titleAsc";
  title: string;
  id: string;
};

/** priceTier 0 = known print price; 1 = no numeric price (always sorted last). */
export type ArtworkPriceCursor = {
  sort: "priceAsc" | "priceDesc";
  priceTier: 0 | 1;
  pricePence: number;
  id: string;
};

export type ArtworkListCursor = ArtworkNewestCursor | ArtworkTitleCursor | ArtworkPriceCursor;

function encodePayload(payload: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

export function encodeArtworkListCursor(cursor: ArtworkListCursor): string {
  switch (cursor.sort) {
    case "newest":
      return encodeCatalogueCursor({ createdAt: cursor.createdAt, id: cursor.id });
    case "titleAsc":
      return encodePayload({ sort: cursor.sort, title: cursor.title, id: cursor.id });
    case "priceAsc":
    case "priceDesc":
      return encodePayload({
        sort: cursor.sort,
        priceTier: cursor.priceTier,
        pricePence: cursor.pricePence,
        id: cursor.id,
      });
  }
}

export function decodeArtworkListCursor(
  value: string | undefined,
  expectedSort: ArtworkCatalogueSort,
): ArtworkListCursor | null {
  if (!value) return null;

  if (expectedSort === "newest") {
    const legacy = decodeCatalogueCursor(value);
    if (legacy) {
      return { sort: "newest", createdAt: legacy.createdAt, id: legacy.id };
    }
    throw new InvalidCatalogueCursorError();
  }

  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as {
      sort?: unknown;
      title?: unknown;
      priceTier?: unknown;
      pricePence?: unknown;
      id?: unknown;
    };
    if (typeof parsed.id !== "string" || !parsed.id) {
      throw new InvalidCatalogueCursorError();
    }
    if (parsed.sort !== expectedSort) {
      throw new InvalidCatalogueCursorError();
    }
    if (expectedSort === "titleAsc") {
      if (typeof parsed.title !== "string") throw new InvalidCatalogueCursorError();
      return { sort: "titleAsc", title: parsed.title, id: parsed.id };
    }
    if (expectedSort === "priceAsc" || expectedSort === "priceDesc") {
      if (parsed.priceTier !== 0 && parsed.priceTier !== 1) {
        throw new InvalidCatalogueCursorError();
      }
      if (typeof parsed.pricePence !== "number" || !Number.isInteger(parsed.pricePence)) {
        throw new InvalidCatalogueCursorError();
      }
      return {
        sort: expectedSort,
        priceTier: parsed.priceTier,
        pricePence: parsed.pricePence,
        id: parsed.id,
      };
    }
    throw new InvalidCatalogueCursorError();
  } catch (error) {
    if (error instanceof InvalidCatalogueCursorError) throw error;
    throw new InvalidCatalogueCursorError();
  }
}
