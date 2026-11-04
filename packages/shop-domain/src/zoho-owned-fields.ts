import { ShopDomainError } from "./shop-domain-error.js";

/**
 * An original made from a Zoho record. Zoho owns what the artwork is: its title, artist, medium,
 * size, year and images. LAX owns the rest (description, how it is sold, search listing), so staff
 * edit those here and the others in Zoho, where a change reaches the listing by itself.
 */
export function isZohoOwnedOriginal(artwork: {
  zohoProductId: string | null;
  salesChannel: "shop" | "art";
  eligibleForEditionAllocation: boolean;
}): boolean {
  return (
    artwork.zohoProductId !== null &&
    artwork.salesChannel === "art" &&
    !artwork.eligibleForEditionAllocation
  );
}

/**
 * What publishing checks beyond the image on a Zoho-owned original: Zoho must hold a size and a
 * medium. Null for any other artwork.
 */
export function zohoCatalogueOf(artwork: {
  zohoProductId: string | null;
  salesChannel: "shop" | "art";
  eligibleForEditionAllocation: boolean;
  dimensions: string | null;
  medium: string | null;
}): { hasSize: boolean; hasMedium: boolean } | null {
  if (!isZohoOwnedOriginal(artwork)) return null;
  return {
    hasSize: (artwork.dimensions ?? "").trim() !== "",
    hasMedium: (artwork.medium ?? "").trim() !== "",
  };
}

export const ZOHO_OWNED_ARTWORK_FIELDS = [
  "title",
  "artistId",
  "yearCreated",
  "medium",
  "dimensions",
  "images",
] as const;
export type ZohoOwnedArtworkField = (typeof ZOHO_OWNED_ARTWORK_FIELDS)[number];

type OwnedValues = {
  title: string;
  artistId: string;
  yearCreated: number | null;
  medium: string | null;
  dimensions: string | null;
  /** Image keys in display order. */
  images: readonly string[];
};

/** The Zoho-owned fields a save would change. */
export function changedZohoOwnedFields(
  current: OwnedValues,
  requested: OwnedValues,
): ZohoOwnedArtworkField[] {
  return ZOHO_OWNED_ARTWORK_FIELDS.filter((field) =>
    field === "images"
      ? current.images.join("\n") !== requested.images.join("\n")
      : current[field] !== requested[field],
  );
}

export const ZOHO_OWNED_FIELDS_MESSAGE =
  "The title, artist, medium, size, year and images come from Zoho. Change them in Zoho.";

/** Refuses a save that edits what Zoho owns on a linked original. */
export function assertZohoOwnedFieldsUnchanged(current: OwnedValues, requested: OwnedValues): void {
  if (changedZohoOwnedFields(current, requested).length > 0) {
    throw new ShopDomainError(ZOHO_OWNED_FIELDS_MESSAGE);
  }
}
