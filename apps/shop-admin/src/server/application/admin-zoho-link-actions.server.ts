"use server";

import type {
  AdminZohoLinkBody,
  AdminZohoLinkBulkResult,
  AdminZohoLinkOutcome,
  AdminZohoLinkPreview,
  AdminZohoLinkReport,
  AdminZohoLinkSearchResult,
  AdminZohoLinkSettings,
  AdminZohoUnlinkBody,
  AdminZohoUnlinkResult,
} from "@auction/shop-contracts";
import type { AdminMutationResult } from "./admin-mutation-result";
import { forwardAdminJsonMutation } from "./forward-admin-mutation";
import { fetchAdminJson } from "./load-admin-data";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BASE = "artwork-register/zoho-link";

const invalidInput = {
  ok: false,
  kind: "validation",
  message: "Invalid request.",
} as const satisfies AdminMutationResult<never>;

async function read<T>(path: string, failed: string): Promise<AdminMutationResult<T>> {
  const result = await fetchAdminJson<T>(path);
  switch (result.status) {
    case "ok":
      return { ok: true, data: result.data };
    case "unauthorized":
      return { ok: false, kind: "unauthorized" };
    case "forbidden":
      return { ok: false, kind: "forbidden" };
    default:
      return { ok: false, kind: "failed", message: failed };
  }
}

/** Matches every unlinked lax.art original again ("Check again"). Reads only. */
export async function getZohoLinkReport(): Promise<AdminMutationResult<AdminZohoLinkReport>> {
  return read(`${BASE}/report`, "Could not check again. Try again in a moment.");
}

/** What linking one artwork to one record would change. */
export async function getZohoLinkPreview(
  artworkId: string,
  registerId: string,
): Promise<AdminMutationResult<AdminZohoLinkPreview>> {
  if (!UUID.test(artworkId) || !UUID.test(registerId)) return invalidInput;
  return read(
    `${BASE}/preview?artworkId=${artworkId}&registerId=${registerId}`,
    "Could not read this record. Try again in a moment.",
  );
}

/** Looks through the register by stock code, title or artist. */
export async function searchZohoRecords(
  query: string,
): Promise<AdminMutationResult<AdminZohoLinkSearchResult>> {
  const q = query.trim();
  if (q.length < 2) return { ok: true, data: { items: [], more: false } };
  return read(
    `${BASE}/search?q=${encodeURIComponent(q.slice(0, 100))}`,
    "Could not search Zoho. Try again in a moment.",
  );
}

/** Links one artwork. Repeating it changes nothing. A refusal comes back as a conflict with the register's words. */
export async function linkToZoho(
  body: AdminZohoLinkBody,
): Promise<AdminMutationResult<AdminZohoLinkOutcome>> {
  if (!UUID.test(body.artworkId) || !UUID.test(body.registerId)) return invalidInput;
  return forwardAdminJsonMutation({
    bffPath: `${BASE}/link`,
    method: "POST",
    jsonBody: { artworkId: body.artworkId, registerId: body.registerId },
  });
}

/** Links the Matched rows staff confirmed. */
export async function linkManyToZoho(
  links: AdminZohoLinkBody[],
): Promise<AdminMutationResult<AdminZohoLinkBulkResult>> {
  if (
    links.length === 0 ||
    links.some((l) => !UUID.test(l.artworkId) || !UUID.test(l.registerId))
  ) {
    return invalidInput;
  }
  return forwardAdminJsonMutation({
    bffPath: `${BASE}/link-bulk`,
    method: "POST",
    jsonBody: { links: links.map((l) => ({ artworkId: l.artworkId, registerId: l.registerId })) },
  });
}

/** Removes a link (Administrator). The reason is kept in the register's history. */
export async function unlinkFromZoho(
  body: AdminZohoUnlinkBody,
): Promise<AdminMutationResult<AdminZohoUnlinkResult>> {
  if (!UUID.test(body.artworkId)) return invalidInput;
  if (body.reason.trim() === "") {
    return { ok: false, kind: "validation", message: "Say why the link is being removed." };
  }
  return forwardAdminJsonMutation({
    bffPath: `${BASE}/unlink`,
    method: "POST",
    jsonBody: { artworkId: body.artworkId, reason: body.reason.trim() },
  });
}

/** Turns the publish switch on or off (Administrator). */
export async function setBlockUnlinkedPublish(
  blockUnlinkedPublish: boolean,
): Promise<AdminMutationResult<AdminZohoLinkSettings>> {
  return forwardAdminJsonMutation({
    bffPath: `${BASE}/settings`,
    method: "PUT",
    jsonBody: { blockUnlinkedPublish },
  });
}
