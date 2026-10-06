"use server";

import { forwardAdminJsonMutation } from "./forward-admin-mutation";

export async function importArtwork(input: {
  importKey: string;
  slug: string;
  title: string;
  description: string | null;
  primaryImageUrl: string | null;
  dimensions?: string | null;
  yearCreated?: number | null;
  saleState?: "for_sale" | "price_on_application" | "sold";
  artistSlug: string;
  artistDisplayName: string;
  artistDiscipline?: string | null;
  artistPortraitUrl?: string | null;
  eligibleForEditionAllocation: boolean;
  printPricePence?: number | null;
  idempotencyKey?: string;
}) {
  return forwardAdminJsonMutation<{ artworkId: string; created: boolean; editionCount: number }>({
    bffPath: "artworks/import",
    method: "POST",
    jsonBody: {
      importKey: input.importKey,
      slug: input.slug,
      title: input.title,
      description: input.description,
      primaryImageUrl: input.primaryImageUrl,
      ...(input.dimensions !== undefined ? { dimensions: input.dimensions } : {}),
      ...(input.yearCreated !== undefined ? { yearCreated: input.yearCreated } : {}),
      ...(input.saleState ? { saleState: input.saleState } : {}),
      artistSlug: input.artistSlug,
      artistDisplayName: input.artistDisplayName,
      ...(input.artistDiscipline !== undefined ? { artistDiscipline: input.artistDiscipline } : {}),
      ...(input.artistPortraitUrl !== undefined
        ? { artistPortraitUrl: input.artistPortraitUrl }
        : {}),
      eligibleForEditionAllocation: input.eligibleForEditionAllocation,
      ...(input.printPricePence !== undefined ? { printPricePence: input.printPricePence } : {}),
    },
    ...(input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : {}),
  });
}

export async function adjustMerchandiseStock(input: {
  variantId: string;
  onHand: number;
  idempotencyKey?: string;
}) {
  return forwardAdminJsonMutation<{ variantId: string; onHand: number }>({
    bffPath: `merchandise/variants/${encodeURIComponent(input.variantId)}/adjust-stock`,
    method: "POST",
    jsonBody: { onHand: input.onHand },
    ...(input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : {}),
  });
}
