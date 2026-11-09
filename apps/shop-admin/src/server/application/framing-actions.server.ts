"use server";

import type {
  AdminEditionFraming,
  AdminEditionFramingSaveBody,
  FramingOption,
  FramingOptionBody,
} from "@auction/shop-contracts";
import type { AdminMutationResult } from "./admin-mutation-result";
import { forwardAdminJsonMutation } from "./forward-admin-mutation";

/*
 * LAX Admin's calls for the framing catalogue: add an option, save one, offer or pause one.
 * shop-api applies every rule again.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const invalidInput = {
  ok: false,
  kind: "validation",
  message: "Invalid framing request.",
} as const satisfies AdminMutationResult<never>;

export async function createFramingOption(input: {
  payload: FramingOptionBody;
  idempotencyKey: string;
}): Promise<AdminMutationResult<FramingOption>> {
  return forwardAdminJsonMutation<FramingOption>({
    bffPath: "framing-options",
    method: "POST",
    jsonBody: input.payload,
    idempotencyKey: input.idempotencyKey,
  });
}

export async function saveFramingOption(input: {
  optionId: string;
  payload: FramingOptionBody;
  /** The option's `version` when it was opened; a newer save by someone else is refused. */
  expectedVersion: string;
  idempotencyKey: string;
}): Promise<AdminMutationResult<FramingOption>> {
  if (!UUID.test(input.optionId)) return invalidInput;
  return forwardAdminJsonMutation<FramingOption>({
    bffPath: `framing-options/${input.optionId}`,
    method: "PUT",
    jsonBody: { ...input.payload, expectedVersion: input.expectedVersion },
    idempotencyKey: input.idempotencyKey,
  });
}

export async function setFramingOptionOffered(input: {
  optionId: string;
  offered: boolean;
  expectedVersion: string;
  idempotencyKey: string;
}): Promise<AdminMutationResult<FramingOption>> {
  if (!UUID.test(input.optionId)) return invalidInput;
  return forwardAdminJsonMutation<FramingOption>({
    bffPath: `framing-options/${input.optionId}/offered`,
    method: "PUT",
    jsonBody: { offered: input.offered, expectedVersion: input.expectedVersion },
    idempotencyKey: input.idempotencyKey,
  });
}

/** Saves how an edition is sold with respect to framing, whole: the mode, the options and prices. */
export async function saveEditionFraming(input: {
  artworkId: string;
  body: AdminEditionFramingSaveBody;
  idempotencyKey: string;
}): Promise<AdminMutationResult<AdminEditionFraming>> {
  if (!UUID.test(input.artworkId)) return invalidInput;
  return forwardAdminJsonMutation<AdminEditionFraming>({
    bffPath: `artworks/${input.artworkId}/framing`,
    method: "PUT",
    jsonBody: input.body,
    idempotencyKey: input.idempotencyKey,
  });
}
