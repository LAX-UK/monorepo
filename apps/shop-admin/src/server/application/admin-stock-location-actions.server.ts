"use server";

import type {
  AdminArtworkLocationMoveBody,
  AdminArtworkLocationMoveResult,
  AdminStockLocationWriteResult,
} from "@auction/shop-contracts";
import type { AdminMutationResult } from "./admin-mutation-result";
import { forwardAdminJsonMutation } from "./forward-admin-mutation";

/*
 * LAX Admin's calls for stock location: keep the list of locations (Administrators, with a recent
 * sign-in) and move artworks (Administrators, Gallery staff and Fulfilment). shop-api checks the
 * capability, the sign-in and every rule again.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const invalidLocation = {
  ok: false,
  kind: "validation",
  message: "Invalid location request.",
} as const satisfies AdminMutationResult<never>;

export async function addStockLocation(input: {
  name: string;
  note: string | null;
  idempotencyKey: string;
}): Promise<AdminMutationResult<AdminStockLocationWriteResult>> {
  return forwardAdminJsonMutation<AdminStockLocationWriteResult>({
    bffPath: "artwork-locations",
    method: "POST",
    jsonBody: { name: input.name, note: input.note },
    idempotencyKey: input.idempotencyKey,
  });
}

/** Rename a location or change its note, against the version it was opened at. */
export async function saveStockLocation(input: {
  locationId: string;
  expectedVersion: number;
  name: string;
  note: string | null;
  idempotencyKey: string;
}): Promise<AdminMutationResult<AdminStockLocationWriteResult>> {
  if (!UUID.test(input.locationId)) return invalidLocation;
  return forwardAdminJsonMutation<AdminStockLocationWriteResult>({
    bffPath: `artwork-locations/${input.locationId}`,
    method: "PATCH",
    jsonBody: { expectedVersion: input.expectedVersion, name: input.name, note: input.note },
    idempotencyKey: input.idempotencyKey,
  });
}

/** Retire a location (it takes no new moves) or restore it. */
export async function setStockLocationStatus(input: {
  locationId: string;
  expectedVersion: number;
  status: "active" | "retired";
  idempotencyKey: string;
}): Promise<AdminMutationResult<AdminStockLocationWriteResult>> {
  if (!UUID.test(input.locationId)) return invalidLocation;
  return forwardAdminJsonMutation<AdminStockLocationWriteResult>({
    bffPath: `artwork-locations/${input.locationId}/${input.status === "retired" ? "retire" : "restore"}`,
    method: "POST",
    jsonBody: { expectedVersion: input.expectedVersion },
    idempotencyKey: input.idempotencyKey,
  });
}

/** "Move" on a record, or "Move selected" on the All list. */
export async function moveArtworksToLocation(input: {
  body: AdminArtworkLocationMoveBody;
  idempotencyKey: string;
}): Promise<AdminMutationResult<AdminArtworkLocationMoveResult>> {
  if (!UUID.test(input.body.locationId) || !input.body.registerIds.every((id) => UUID.test(id))) {
    return invalidLocation;
  }
  return forwardAdminJsonMutation<AdminArtworkLocationMoveResult>({
    bffPath: "artwork-location-moves",
    method: "POST",
    jsonBody: input.body,
    idempotencyKey: input.idempotencyKey,
  });
}
