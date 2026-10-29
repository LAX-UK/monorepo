import "server-only";

import { authedServerFetch } from "@/lib/data/http/authed-fetch.server";
import {
  type DocumentSlot,
  orgDocumentSlots,
  orgDocumentSlotsNeedRequirements,
} from "@/lib/legal-entity/org-document-requirements";
import type { PublicOrganisationSubkind } from "@auction/validators";

/** The documents asked of an organisation of `subkind`, or `null` when the list cannot load. */
export async function loadOrgDocumentSlots(
  subkind: PublicOrganisationSubkind,
  fetcher: typeof authedServerFetch = authedServerFetch,
): Promise<DocumentSlot[] | null> {
  if (!orgDocumentSlotsNeedRequirements(subkind)) return orgDocumentSlots(subkind, []);
  const res = await fetcher(`/organizations/requirements/${subkind}`, { cache: "no-store" });
  if (!res.ok) return null;
  const body = (await res.json()) as { data?: { documentKinds?: string[] } };
  return orgDocumentSlots(subkind, body.data?.documentKinds ?? []);
}
