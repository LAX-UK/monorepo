"use server";

import type { AdminPrintParty, AdminPrintPartyList } from "@auction/shop-contracts";
import type { AdminMutationResult } from "./admin-mutation-result";
import { forwardAdminJsonMutation } from "./forward-admin-mutation";
import { fetchAdminJson } from "./load-admin-data";

/*
 * The printers and publishers list in Settings, which the Edition facts card picks "Printed by"
 * and "Published by" from. Each call forwards to shop-api, which applies the capability rules.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The names, A to Z; null when the list cannot be read, so a picker says so instead of guessing. */
export async function listPrintPartyNames(): Promise<string[] | null> {
  const result = await fetchAdminJson<AdminPrintPartyList>("print-parties");
  return result.status === "ok" ? result.data.items.map((party) => party.name) : null;
}

export async function addPrintParty(input: {
  name: string;
  idempotencyKey: string;
}): Promise<AdminMutationResult<AdminPrintParty>> {
  return forwardAdminJsonMutation<AdminPrintParty>({
    bffPath: "print-parties",
    method: "POST",
    jsonBody: { name: input.name },
    idempotencyKey: input.idempotencyKey,
  });
}

export async function removePrintParty(input: {
  id: string;
  idempotencyKey: string;
}): Promise<AdminMutationResult<unknown>> {
  if (!UUID.test(input.id)) {
    return { ok: false, kind: "validation", message: "That name is not in the list." };
  }
  return forwardAdminJsonMutation({
    bffPath: `print-parties/${input.id}`,
    method: "DELETE",
    idempotencyKey: input.idempotencyKey,
  });
}
