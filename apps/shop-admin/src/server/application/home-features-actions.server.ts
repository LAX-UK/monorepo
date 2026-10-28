"use server";

import {
  ADMIN_HOME_FEATURE_SLOT_VALUES,
  ADMIN_LOOKUP_SEARCH_MAX_LENGTH,
  type AdminHomeFeatureRow,
  type AdminHomeFeatureSlot,
  type AdminHomeFeatures,
} from "@auction/shop-contracts";
import type { AdminMutationResult } from "./admin-mutation-result";
import { forwardAdminJsonMutation } from "./forward-admin-mutation";
import { fetchAdminJson } from "./load-admin-data";

/*
 * LAX Admin's calls for Featured on home: search what can be added to a list, and save a list.
 * shop-api applies every rule again.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isSlot(value: string): value is AdminHomeFeatureSlot {
  return (ADMIN_HOME_FEATURE_SLOT_VALUES as readonly string[]).includes(value);
}

const invalidInput = {
  ok: false,
  kind: "validation",
  message: "Invalid featured list.",
} as const satisfies AdminMutationResult<never>;

/** Records that can go in a list, matching what was typed; empty text lists the newest. */
export async function searchHomeFeatureCandidates<S extends AdminHomeFeatureSlot>(
  slot: S,
  query: string,
): Promise<AdminHomeFeatureRow<S>[]> {
  if (!isSlot(slot)) return [];
  const params = new URLSearchParams({ limit: "15" });
  const q = query.trim().slice(0, ADMIN_LOOKUP_SEARCH_MAX_LENGTH);
  if (q) params.set("q", q);
  const result = await fetchAdminJson<{ items: AdminHomeFeatureRow<S>[] }>(
    `home-features/${slot}/candidates?${params.toString()}`,
  );
  return result.status === "ok" ? result.data.items : [];
}

/** Replaces one list, in order, and returns every list as saved. */
export async function saveHomeFeatureList(input: {
  slot: AdminHomeFeatureSlot;
  ids: string[];
  idempotencyKey: string;
}): Promise<AdminMutationResult<AdminHomeFeatures>> {
  if (!isSlot(input.slot) || !input.ids.every((id) => UUID.test(id))) return invalidInput;
  return forwardAdminJsonMutation({
    bffPath: `home-features/${input.slot}`,
    method: "PUT",
    jsonBody: { ids: input.ids },
    idempotencyKey: input.idempotencyKey,
  });
}
