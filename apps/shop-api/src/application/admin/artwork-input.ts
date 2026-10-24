import { type AdminArtworkUpdateBody, SHOP_API_ERROR_CODES } from "@auction/shop-contracts";
import { ShopApiError } from "../../errors/shop-api-error.js";
import type { ArtworkEditableFields } from "../ports/artwork-catalogue-admin.js";

type EditableBody = Omit<AdminArtworkUpdateBody, "expectedVersion">;

function optional(value: string | null): string | null {
  return value?.trim() || null;
}

function required(value: string, what: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new ShopApiError(SHOP_API_ERROR_CODES.VALIDATION, `${what} is required`, 400);
  }
  return trimmed;
}

/** Trims staff-typed text; blank optional text is stored as no value, so pages fall back cleanly. */
export function cleanArtworkFields(body: EditableBody): ArtworkEditableFields {
  return {
    title: required(body.title, "Title"),
    artistId: body.artistId,
    yearCreated: body.yearCreated,
    medium: optional(body.medium),
    dimensions: optional(body.dimensions),
    description: optional(body.description),
    printPricePence: body.printPricePence ?? null,
    saleState: body.saleState,
    salesChannel: body.salesChannel,
    images: body.images.map((image) => ({
      mediaKey: image.mediaKey.trim(),
      alt: optional(image.alt),
    })),
    seoTitle: optional(body.seoTitle),
    seoDescription: optional(body.seoDescription),
  };
}

export function cleanArtistFields(body: {
  displayName: string;
  slug: string;
  discipline: string | null;
}) {
  return {
    displayName: required(body.displayName, "Name"),
    slug: required(body.slug, "Slug"),
    discipline: optional(body.discipline),
  };
}
