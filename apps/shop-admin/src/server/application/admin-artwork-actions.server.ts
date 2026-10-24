"use server";

import type {
  AdminArtistCreateBody,
  AdminArtistList,
  AdminArtworkBulkVisibilityResponse,
  AdminArtworkCreateBody,
  AdminArtworkDetail,
  AdminArtworkUpdateBody,
  AdminArtworkVersionResponse,
  AdminArtworkVisibilityAction,
} from "@auction/shop-contracts";
import type { AdminMutationResult } from "./admin-mutation-result";
import { forwardAdminJsonMutation } from "./forward-admin-mutation";
import { fetchAdminJson } from "./load-admin-data";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VISIBILITY = new Set<AdminArtworkVisibilityAction>([
  "publish",
  "unpublish",
  "archive",
  "restore",
]);

const invalidInput = {
  ok: false,
  kind: "validation",
  message: "Invalid artwork request.",
} as const satisfies AdminMutationResult<never>;

function artworkPath(artworkId: string): string | null {
  return UUID.test(artworkId) ? `artworks/${artworkId}` : null;
}

function artistPath(artistId: string): string | null {
  return UUID.test(artistId) ? `artists/${artistId}` : null;
}

/** The artwork as stored now: for the quick view, and the editor's reload after a conflict. */
export async function getArtworkDetail(
  artworkId: string,
): Promise<AdminMutationResult<AdminArtworkDetail>> {
  const path = artworkPath(artworkId);
  if (!path) return invalidInput;
  const result = await fetchAdminJson<AdminArtworkDetail>(path);
  switch (result.status) {
    case "ok":
      return { ok: true, data: result.data };
    case "unauthorized":
      return { ok: false, kind: "unauthorized" };
    case "forbidden":
      return { ok: false, kind: "forbidden" };
    case "not_found":
      return { ok: false, kind: "failed", message: "This artwork no longer exists." };
    default:
      return { ok: false, kind: "failed", message: "Could not load this artwork." };
  }
}

export async function createArtwork(input: {
  body: AdminArtworkCreateBody;
  idempotencyKey: string;
}): Promise<AdminMutationResult<{ artworkId: string; slug: string; version: string }>> {
  return forwardAdminJsonMutation({
    bffPath: "artworks",
    method: "POST",
    jsonBody: input.body,
    idempotencyKey: input.idempotencyKey,
  });
}

export async function saveArtwork(input: {
  artworkId: string;
  body: Omit<AdminArtworkUpdateBody, "expectedVersion">;
  /** The version the editor opened, or the one it chose to overwrite. */
  expectedVersion: string;
  idempotencyKey: string;
}): Promise<AdminMutationResult<{ version: string }>> {
  const path = artworkPath(input.artworkId);
  if (!path) return invalidInput;
  return forwardAdminJsonMutation({
    bffPath: path,
    method: "PUT",
    jsonBody: { ...input.body, expectedVersion: input.expectedVersion },
    idempotencyKey: input.idempotencyKey,
  });
}

/** The edition price alone, for staff who may set prices but not edit the catalogue. */
export async function saveArtworkPrice(input: {
  artworkId: string;
  printPricePence: number | null;
  expectedVersion: string;
  idempotencyKey: string;
}): Promise<AdminMutationResult<{ version: string }>> {
  const path = artworkPath(input.artworkId);
  if (!path) return invalidInput;
  return forwardAdminJsonMutation({
    bffPath: `${path}/price`,
    method: "PUT",
    jsonBody: {
      ...(input.printPricePence === null ? {} : { printPricePence: input.printPricePence }),
      expectedVersion: input.expectedVersion,
    },
    idempotencyKey: input.idempotencyKey,
  });
}

export async function setArtworkVisibility(input: {
  artworkId: string;
  action: AdminArtworkVisibilityAction;
  idempotencyKey: string;
}): Promise<AdminMutationResult<AdminArtworkVersionResponse>> {
  const path = artworkPath(input.artworkId);
  if (!path || !VISIBILITY.has(input.action)) return invalidInput;
  return forwardAdminJsonMutation({
    bffPath: `${path}/${input.action}`,
    method: "POST",
    idempotencyKey: input.idempotencyKey,
  });
}

export async function bulkArtworkVisibility(input: {
  action: AdminArtworkVisibilityAction;
  artworkIds: string[];
  idempotencyKey: string;
}): Promise<AdminMutationResult<AdminArtworkBulkVisibilityResponse>> {
  if (!VISIBILITY.has(input.action) || !input.artworkIds.every((id) => UUID.test(id))) {
    return invalidInput;
  }
  return forwardAdminJsonMutation({
    bffPath: "artworks/visibility",
    method: "POST",
    jsonBody: { action: input.action, artworkIds: input.artworkIds },
    idempotencyKey: input.idempotencyKey,
  });
}

export type ArtistOption = { id: string; label: string; description?: string };

/** Artists matching `query` for the artist picker: active artists, newest first. */
export async function searchArtistOptions(query: string): Promise<ArtistOption[]> {
  const params = new URLSearchParams({ limit: "20", status: "active" });
  const q = query.trim().slice(0, 100);
  if (q) params.set("q", q);
  const result = await fetchAdminJson<AdminArtistList>(`artists?${params.toString()}`);
  if (result.status !== "ok") return [];
  return result.data.items.map((artist) => ({
    id: artist.artistId,
    label: artist.displayName,
    ...(artist.discipline ? { description: artist.discipline } : {}),
  }));
}

export async function createArtist(input: {
  body: AdminArtistCreateBody;
  idempotencyKey: string;
}): Promise<AdminMutationResult<{ artistId: string; slug: string }>> {
  return forwardAdminJsonMutation({
    bffPath: "artists",
    method: "POST",
    jsonBody: input.body,
    idempotencyKey: input.idempotencyKey,
  });
}

export async function setArtistArchived(input: {
  artistId: string;
  archived: boolean;
  idempotencyKey: string;
}): Promise<AdminMutationResult<{ artistId: string; archived: boolean }>> {
  const path = artistPath(input.artistId);
  if (!path) return invalidInput;
  return forwardAdminJsonMutation({
    bffPath: `${path}/${input.archived ? "archive" : "restore"}`,
    method: "POST",
    idempotencyKey: input.idempotencyKey,
  });
}
