"use server";

import type {
  AdminCompanionListingBody,
  AdminEditionFactsBulkBody,
  AdminEditionFactsBulkResponse,
  AdminEditionFactsCorrectBody,
  AdminEditionFactsSaveBody,
  AdminOriginalPrints,
  AdminPrintsFromOriginalResponse,
  AdminProofListingBody,
  AdminReturnPrintResponse,
  AdminRunUpdateBody,
  AdminSetPrintApartBody,
  AdminStockBatchBody,
} from "@auction/shop-contracts";
import type { AdminMutationResult } from "./admin-mutation-result";
import { forwardAdminJsonMutation } from "./forward-admin-mutation";

/*
 * LAX Admin's calls for runs of prints: change a draft's run, save, confirm or correct its
 * edition facts, add open edition stock, create proof and companion listings, and create prints of
 * an original. Each forwards to shop-api, which applies the rules again.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const invalidInput = {
  ok: false,
  kind: "validation",
  message: "Invalid edition run request.",
} as const satisfies AdminMutationResult<never>;

function artworkPath(artworkId: string, rest: string): string | null {
  return UUID.test(artworkId) ? `artworks/${artworkId}/${rest}` : null;
}

type Write<B> = { artworkId: string; body: B; idempotencyKey: string };

export async function saveEditionRun(
  input: Write<AdminRunUpdateBody>,
): Promise<AdminMutationResult<{ version: string }>> {
  const path = artworkPath(input.artworkId, "run");
  if (!path) return invalidInput;
  return forwardAdminJsonMutation({
    bffPath: path,
    method: "PUT",
    jsonBody: input.body,
    idempotencyKey: input.idempotencyKey,
  });
}

export async function saveEditionFacts(
  input: Write<AdminEditionFactsSaveBody>,
): Promise<AdminMutationResult<{ factsVersion: string; confirmed: boolean }>> {
  const path = artworkPath(input.artworkId, "edition-facts");
  if (!path) return invalidInput;
  return forwardAdminJsonMutation({
    bffPath: path,
    method: "PUT",
    jsonBody: input.body,
    idempotencyKey: input.idempotencyKey,
  });
}

export async function correctEditionFacts(
  input: Write<AdminEditionFactsCorrectBody>,
): Promise<
  AdminMutationResult<{ factsVersion: string; confirmed: boolean; affectedOrders: number }>
> {
  const path = artworkPath(input.artworkId, "edition-facts/correct");
  if (!path) return invalidInput;
  return forwardAdminJsonMutation({
    bffPath: path,
    method: "POST",
    jsonBody: input.body,
    idempotencyKey: input.idempotencyKey,
  });
}

export async function setEditionFactsForRuns(input: {
  body: AdminEditionFactsBulkBody;
  idempotencyKey: string;
}): Promise<AdminMutationResult<AdminEditionFactsBulkResponse>> {
  if (!input.body.artworkIds.every((id) => UUID.test(id))) return invalidInput;
  return forwardAdminJsonMutation({
    bffPath: "artworks/edition-facts",
    method: "POST",
    jsonBody: input.body,
    idempotencyKey: input.idempotencyKey,
  });
}

export async function addOpenEditionStock(input: Write<AdminStockBatchBody>): Promise<
  AdminMutationResult<{
    batchId: string;
    firstStockRef: number;
    quantity: number;
    laxPrintsOnSale: number;
  }>
> {
  const path = artworkPath(input.artworkId, "stock-batches");
  if (!path) return invalidInput;
  return forwardAdminJsonMutation({
    bffPath: path,
    method: "POST",
    jsonBody: input.body,
    idempotencyKey: input.idempotencyKey,
  });
}

type ListingResult = AdminMutationResult<{ artworkId: string; slug: string; version: string }>;

export async function createProofListing(
  input: Write<AdminProofListingBody>,
): Promise<ListingResult> {
  const path = artworkPath(input.artworkId, "proof-listings");
  if (!path) return invalidInput;
  return forwardAdminJsonMutation({
    bffPath: path,
    method: "POST",
    jsonBody: input.body,
    idempotencyKey: input.idempotencyKey,
  });
}

export async function createCompanionListing(
  input: Write<AdminCompanionListingBody>,
): Promise<ListingResult> {
  const path = artworkPath(input.artworkId, "companion-listings");
  if (!path) return invalidInput;
  return forwardAdminJsonMutation({
    bffPath: path,
    method: "POST",
    jsonBody: input.body,
    idempotencyKey: input.idempotencyKey,
  });
}

/** Sell one print of a run on its own, as a listing of its own with its own price. */
export async function setPrintApart(input: {
  /** The run the print belongs to. */
  artworkId: string;
  editionId: string;
  body: AdminSetPrintApartBody;
  idempotencyKey: string;
}): Promise<ListingResult> {
  if (!UUID.test(input.editionId)) return invalidInput;
  const path = artworkPath(input.artworkId, `prints/${input.editionId}/set-apart`);
  if (!path) return invalidInput;
  return forwardAdminJsonMutation({
    bffPath: path,
    method: "POST",
    jsonBody: input.body,
    idempotencyKey: input.idempotencyKey,
  });
}

/** Put a print sold on its own back in its run, while it is unsold. */
export async function returnPrintToRun(input: {
  /** The listing the print is sold from. */
  artworkId: string;
  idempotencyKey: string;
}): Promise<AdminMutationResult<AdminReturnPrintResponse>> {
  const path = artworkPath(input.artworkId, "return-print");
  if (!path) return invalidInput;
  return forwardAdminJsonMutation({
    bffPath: path,
    method: "POST",
    jsonBody: {},
    idempotencyKey: input.idempotencyKey,
  });
}

/** "Create prints" on a saved original: a linked Shop draft with its run, in one save. */
export async function createPrintsFromOriginal(
  input: Write<AdminOriginalPrints>,
): Promise<AdminMutationResult<AdminPrintsFromOriginalResponse>> {
  const path = artworkPath(input.artworkId, "prints");
  if (!path) return invalidInput;
  return forwardAdminJsonMutation({
    bffPath: path,
    method: "POST",
    jsonBody: input.body,
    idempotencyKey: input.idempotencyKey,
  });
}
