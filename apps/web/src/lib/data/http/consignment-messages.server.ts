import "server-only";

import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import { type ConsignmentThread, parseConsignmentThread } from "@/lib/seller/consignment-thread";

/**
 * The messages on one consignment of the account being used. `null` when they could not be
 * read (the page says so and offers to try again); a consignment the member may not see is
 * already a Not found for the page itself.
 */
export async function getServerConsignmentThread(
  submissionId: string,
): Promise<ConsignmentThread | null> {
  const res = await authedServerFetch(`/submissions/${encodeURIComponent(submissionId)}/messages`);
  if (!res.ok) return null;
  return parseConsignmentThread(await res.json().catch(() => null));
}
