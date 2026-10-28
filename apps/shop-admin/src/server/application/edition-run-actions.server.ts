"use server";

import type {
  AdminCompanionListingBody,
  AdminEditionFactsBulkBody,
  AdminEditionFactsBulkResponse,
  AdminEditionFactsCorrectBody,
  AdminEditionFactsSaveBody,
  AdminProofListingBody,
  AdminRunUpdateBody,
  AdminStockBatchBody,
} from "@auction/shop-contracts";
import type { AdminMutationResult } from "./admin-mutation-result";
import { forwardAdminJsonMutation } from "./forward-admin-mutation";

/*
 * LAX Admin's calls for runs of prints: change a draft's run, save, confirm or correct its
 * edition facts, add open edition stock, and create proof and companion listings. Each forwards
 * to shop-api, which applies the rules again.
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
