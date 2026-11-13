"use server";

import {
  ADMIN_LOOKUP_SEARCH_MAX_LENGTH,
  type AdminHomeCover,
  type AdminHomeCoverPictureCandidate,
  HOME_COVER_ALT_MAX_LENGTH,
} from "@auction/shop-contracts";
import type { AdminMutationResult } from "./admin-mutation-result";
import { forwardAdminJsonMutation } from "./forward-admin-mutation";
import { fetchAdminJson } from "./load-admin-data";

/*
 * LAX Admin's calls for the Shop home's cover image: search the Shop's pictures, save the choice
 * and remove it. shop-api applies every rule again.
 */

const invalidInput = {
  ok: false,
  kind: "validation",
  message: "Invalid cover image.",
} as const satisfies AdminMutationResult<never>;

const unit = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;

/** Pictures of live Shop editions, matching what was typed; empty text lists the newest. */
export async function searchHomeCoverPictures(
  query: string,
): Promise<AdminHomeCoverPictureCandidate[]> {
  const params = new URLSearchParams({ limit: "15" });
  const q = query.trim().slice(0, ADMIN_LOOKUP_SEARCH_MAX_LENGTH);
  if (q) params.set("q", q);
  const result = await fetchAdminJson<{ items: AdminHomeCoverPictureCandidate[] }>(
    `home-cover/pictures?${params.toString()}`,
  );
  return result.status === "ok" ? result.data.items : [];
}

/** Makes the picture the Shop home's cover and returns the cover as saved. */
export async function saveHomeCover(input: {
  mediaKey: string;
  alt: string;
  focal: { x: number; y: number };
  idempotencyKey: string;
}): Promise<AdminMutationResult<AdminHomeCover>> {
  if (
    !input.mediaKey.trim() ||
    input.alt.length > HOME_COVER_ALT_MAX_LENGTH ||
    !unit(input.focal.x) ||
    !unit(input.focal.y)
  ) {
    return invalidInput;
  }
  return forwardAdminJsonMutation({
    bffPath: "home-cover",
    method: "PUT",
    jsonBody: { mediaKey: input.mediaKey, alt: input.alt, focal: input.focal },
    idempotencyKey: input.idempotencyKey,
  });
}

/** Removes the cover; the home leads with the newest release again. */
export async function removeHomeCover(input: {
  idempotencyKey: string;
}): Promise<AdminMutationResult<AdminHomeCover>> {
  return forwardAdminJsonMutation({
    bffPath: "home-cover",
    method: "DELETE",
    idempotencyKey: input.idempotencyKey,
  });
}
