"use server";

import { isUuid } from "@/lib/editorial-entity-forms";
import type {
  EditorialLinkCandidatesResponse,
  EditorialLinkKind,
  EditorialLinksReplaceResponse,
} from "@auction/shop-contracts";
import {
  type EditorialLinkList,
  type EditorialLinkParent,
  type LinksPayload,
  linkSectionsFor,
} from "../domain/editorial-links.vm";
import type { AdminMutationResult } from "./admin-mutation-result";
import { forwardAdminJsonMutation } from "./forward-admin-mutation";
import { fetchAdminJson } from "./load-admin-data";

const PARENTS: readonly EditorialLinkParent[] = ["exhibitions", "stories"];
const CANDIDATE_KINDS: readonly EditorialLinkKind[] = ["artwork", "artist", "story", "exhibition"];
const CANDIDATE_PAGE_SIZE = 20;

const invalidInput = {
  ok: false,
  kind: "validation",
  message: "Invalid link request.",
} as const satisfies AdminMutationResult<never>;

function linksPath(parent: EditorialLinkParent, id: string): string | null {
  return PARENTS.includes(parent) && isUuid(id) ? `editorial/${parent}/${id}/links` : null;
}

function fetchFailure(status: string): AdminMutationResult<never> {
  switch (status) {
    case "unauthorized":
      return { ok: false, kind: "unauthorized" };
    case "forbidden":
      return { ok: false, kind: "forbidden" };
    default:
      return { ok: false, kind: "failed", message: "Could not load the links." };
  }
}

/** Reads every list of one exhibition or story; the editor calls it to reload after a conflict. */
export async function getEditorialLinks(
  parent: EditorialLinkParent,
  id: string,
): Promise<AdminMutationResult<LinksPayload>> {
  const path = linksPath(parent, id);
  if (!path) return invalidInput;
  const result = await fetchAdminJson<LinksPayload>(path);
  return result.status === "ok" ? { ok: true, data: result.data } : fetchFailure(result.status);
}

/**
 * Replaces one list. `expectedVersion` is the token from the last read or save of this parent's
 * links; a stale one comes back as a conflict carrying the current version.
 */
export async function replaceEditorialLinkList(input: {
  parent: EditorialLinkParent;
  id: string;
  list: EditorialLinkList;
  ids: string[];
  expectedVersion: string;
  idempotencyKey: string;
}): Promise<AdminMutationResult<EditorialLinksReplaceResponse>> {
  const path = linksPath(input.parent, input.id);
  const allowed = linkSectionsFor(input.parent).some((spec) => spec.list === input.list);
  if (!path || !allowed || !input.ids.every(isUuid) || !input.expectedVersion) {
    return invalidInput;
  }
  return forwardAdminJsonMutation<EditorialLinksReplaceResponse>({
    bffPath: `${path}/${input.list}`,
    method: "PUT",
    jsonBody: { ids: input.ids, expectedVersion: input.expectedVersion },
    idempotencyKey: input.idempotencyKey,
  });
}

/** One page of records staff can link, matching `query` (empty lists the most recent). */
export async function searchEditorialLinkCandidates(input: {
  kind: EditorialLinkKind;
  query: string;
  cursor: string | null;
}): Promise<AdminMutationResult<EditorialLinkCandidatesResponse>> {
  if (!CANDIDATE_KINDS.includes(input.kind)) return invalidInput;
  const params = new URLSearchParams({ kind: input.kind, limit: String(CANDIDATE_PAGE_SIZE) });
  if (input.query.trim()) params.set("q", input.query.trim().slice(0, 200));
  if (input.cursor) params.set("cursor", input.cursor.slice(0, 512));
  const result = await fetchAdminJson<EditorialLinkCandidatesResponse>(
    `editorial/link-candidates?${params.toString()}`,
  );
  return result.status === "ok" ? { ok: true, data: result.data } : fetchFailure(result.status);
}
