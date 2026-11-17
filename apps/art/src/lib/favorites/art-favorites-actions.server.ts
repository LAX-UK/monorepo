"use server";

import { artCommerceMutationClient } from "@/lib/art-commerce-mutation.server";
import {
  type FavoriteMutationOutcome,
  type FavoriteTarget,
  mutateFavorite,
} from "@/lib/favorites/favorite-mutation";
import type { FollowEmailsState } from "@/lib/favorites/follow-emails";
import { type TurnOnFollowEmailsOutcome, turnOnFollowEmails } from "@/lib/favorites/follow-emails";
import { revalidatePath } from "next/cache";

/**
 * `revalidate: false` is for a page that draws favourites in the browser (the prerendered home
 * page): revalidating would make Next redraw that page in the action's answer, for nothing, since
 * its server render shows no favourites. The favourites page is read per request either way.
 */
export type FavoriteActionOptions = { revalidate?: boolean };

async function runFavoriteMutation(
  target: FavoriteTarget,
  slug: string,
  active: boolean,
  options: FavoriteActionOptions = {},
): Promise<FavoriteMutationOutcome> {
  const outcome = await mutateFavorite(artCommerceMutationClient, { target, slug, active });
  if (outcome.ok && options.revalidate !== false) revalidatePath("/account/favourites");
  return outcome;
}

export async function saveArtworkFavorite(
  slug: string,
  options?: FavoriteActionOptions,
): Promise<FavoriteMutationOutcome> {
  return runFavoriteMutation("artwork", slug, true, options);
}

export async function removeArtworkFavorite(
  slug: string,
  options?: FavoriteActionOptions,
): Promise<FavoriteMutationOutcome> {
  return runFavoriteMutation("artwork", slug, false, options);
}

export async function followArtist(
  slug: string,
  options?: FavoriteActionOptions,
): Promise<FavoriteMutationOutcome> {
  return runFavoriteMutation("artist", slug, true, options);
}

export async function unfollowArtist(
  slug: string,
  options?: FavoriteActionOptions,
): Promise<FavoriteMutationOutcome> {
  return runFavoriteMutation("artist", slug, false, options);
}

/** Switches emails about followed artists back on, from the Follow button's "Turn on". */
export async function turnOnFollowEmailsAction(): Promise<TurnOnFollowEmailsOutcome> {
  return turnOnFollowEmails(artCommerceMutationClient);
}

/** What a follow did to the emails: whether they are on, and whether the person stopped them all. */
export async function followEmailsStateAction(): Promise<FollowEmailsState> {
  const { loadArtFollowEmailsState } = await import("@/lib/favorites/art-favorites.server");
  return loadArtFollowEmailsState();
}
