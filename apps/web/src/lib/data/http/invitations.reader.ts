import "server-only";

import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import { readJsonBody } from "@/lib/data/http/envelope";
import type {
  AdminInvitationSummary,
  AdminInvitationsPage,
  AdminInvitationsPageParams,
} from "@/lib/data/http/invitations.shared";
import {
  buildAdminInvitationsSearchParams,
  parseAdminInvitationsPageBody,
} from "@/lib/data/http/invitations.shared";
import { isIndexableObject } from "@/lib/data/http/object-guards";
import { normalizeApiErrorMessage } from "@auction/validators";

export type {
  AdminInvitationSummary,
  AdminInvitationsListSummary,
  AdminInvitationsPage,
  AdminInvitationsPageParams,
} from "@/lib/data/http/invitations.shared";

function readApiError(body: unknown, fallback: string): string {
  const error = isIndexableObject(body) ? body.error : undefined;
  return normalizeApiErrorMessage(error, fallback);
}

/** Server-side paginated invitations list with authoritative summary meta. */
export async function getAdminInvitationsPage(
  params: AdminInvitationsPageParams,
): Promise<AdminInvitationsPage> {
  const qs = buildAdminInvitationsSearchParams(params);
  const res = await authedServerFetch(`/admin/invitations?${qs.toString()}`, {
    cache: "no-store",
  });
  if (res.status === 403 || res.status === 401) {
    throw new Error("forbidden");
  }
  if (!res.ok) {
    const body = await readJsonBody(res).catch(() => ({}));
    throw new Error(readApiError(body, "Could not load invitations"));
  }
  const body = await readJsonBody(res);
  return parseAdminInvitationsPageBody(body, params);
}

/** Walk list pages until an invitation id is found (off-page preview). */
export async function findAdminInvitationInList(
  invitationId: string,
  opts?: { pageSize?: number; knownTotal?: number; status?: AdminInvitationsPageParams["status"] },
): Promise<AdminInvitationSummary | null> {
  const limit = opts?.pageSize ?? 50;
  let offset = 0;
  let total = opts?.knownTotal ?? Number.POSITIVE_INFINITY;

  while (offset < total) {
    const page = await getAdminInvitationsPage({
      limit,
      offset,
      ...(opts?.status ? { status: opts.status } : {}),
    });
    total = page.total;
    const found = page.rows.find((row) => row.id === invitationId);
    if (found) return found;
    if (page.rows.length === 0) break;
    offset += limit;
  }

  return null;
}
