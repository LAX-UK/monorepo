"use server";

import { artCommerceMutationClient } from "@/lib/art-commerce-mutation.server";
import {
  type FavoriteMutationOutcome,
  type FavoriteTarget,
  mutateFavorite,
} from "@/lib/favorites/favorite-mutation";
import { revalidatePath } from "next/cache";

async function runFavoriteMutation(
  target: FavoriteTarget,
  slug: string,
  active: boolean,
): Promise<FavoriteMutationOutcome> {
  const outcome = await mutateFavorite(artCommerceMutationClient, { target, slug, active });
  if (outcome.ok) revalidatePath("/account/favourites");
  return outcome;
}

export async function saveArtworkFavorite(slug: string): Promise<FavoriteMutationOutcome> {
  return runFavoriteMutation("artwork", slug, true);
}

export async function removeArtworkFavorite(slug: string): Promise<FavoriteMutationOutcome> {
  return runFavoriteMutation("artwork", slug, false);
}

export async function followArtist(slug: string): Promise<FavoriteMutationOutcome> {
  return runFavoriteMutation("artist", slug, true);
}

export async function unfollowArtist(slug: string): Promise<FavoriteMutationOutcome> {
  return runFavoriteMutation("artist", slug, false);
}
