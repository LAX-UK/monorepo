import type {
  ArtCommerceMutationClient,
  ArtCommerceMutationResult,
} from "@/lib/art-commerce-mutation.server";
import { isCatalogueSlug } from "@/lib/catalogue/catalogue-slug";

export type FavoriteTarget = "artwork" | "artist";

export type FavoriteMutationFailure =
  | "sign_in_required"
  | "session_expired"
  | "not_found"
  | "invalid"
  | "unavailable";

export type FavoriteMutationOutcome =
  | { ok: true; active: boolean }
  | { ok: false; reason: FavoriteMutationFailure; message: string };

const ACTIVE_STATUSES = new Set(["saved", "already_saved", "followed", "already_followed"]);
const INACTIVE_STATUSES = new Set(["removed", "already_removed"]);

const FAILURE_MESSAGES: Record<FavoriteTarget, Record<FavoriteMutationFailure, string>> = {
  artwork: {
    sign_in_required: "Sign in to save artworks.",
    session_expired: "Your session expired. Refresh the page and try again.",
    not_found: "This artwork is no longer available.",
    invalid: "We could not update your favourites.",
    unavailable: "We could not update your favourites. Try again shortly.",
  },
  artist: {
    sign_in_required: "Sign in to follow artists.",
    session_expired: "Your session expired. Refresh the page and try again.",
    not_found: "This artist is no longer available.",
    invalid: "We could not update the artists you follow.",
    unavailable: "We could not update the artists you follow. Try again shortly.",
  },
};

export function favoriteMutationPath(target: FavoriteTarget, slug: string): string {
  const collection = target === "artwork" ? "artworks" : "artists";
  return `/commerce/me/favorites/${collection}/${encodeURIComponent(slug)}`;
}

function failure(target: FavoriteTarget, reason: FavoriteMutationFailure): FavoriteMutationOutcome {
  return { ok: false, reason, message: FAILURE_MESSAGES[target][reason] };
}

function readStatus(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const status = (body as { status?: unknown }).status;
  return typeof status === "string" ? status : null;
}

function readError(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const error = (body as { error?: unknown }).error;
  return typeof error === "string" ? error : null;
}

export function interpretFavoriteMutation(
  target: FavoriteTarget,
  requestedActive: boolean,
  result: ArtCommerceMutationResult,
): FavoriteMutationOutcome {
  if (result.kind === "csrf_unavailable") return failure(target, "session_expired");
  if (result.kind === "network_error") return failure(target, "unavailable");
  const { status, body } = result;
  if (status >= 200 && status < 300) {
    const upstream = readStatus(body);
    if (upstream && ACTIVE_STATUSES.has(upstream)) return { ok: true, active: true };
    if (upstream && INACTIVE_STATUSES.has(upstream)) return { ok: true, active: false };
    return { ok: true, active: requestedActive };
  }
  if (status === 401) return failure(target, "sign_in_required");
  if (status === 403 && readError(body) === "csrf_failed")
    return failure(target, "session_expired");
  if (status === 404) return failure(target, "not_found");
  if (status === 400 || status === 422) return failure(target, "invalid");
  return failure(target, "unavailable");
}

export async function mutateFavorite(
  client: ArtCommerceMutationClient,
  input: { target: FavoriteTarget; slug: string; active: boolean },
): Promise<FavoriteMutationOutcome> {
  if (!isCatalogueSlug(input.slug)) return failure(input.target, "invalid");
  const result = await client.mutate(favoriteMutationPath(input.target, input.slug.trim()), {
    method: input.active ? "PUT" : "DELETE",
  });
  return interpretFavoriteMutation(input.target, input.active, result);
}
