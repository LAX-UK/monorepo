import "server-only";

import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import type { AdminInvitationsPageParams } from "@/lib/data/http/invitations.shared";
import {
  type AdminInvitationWire,
  type AdminInvitationsPage,
  buildAdminInvitationsSearchParams,
  parseAdminInvitationsPageBody,
} from "@/lib/data/http/invitations.shared";

export type {
  AdminInvitationSummary,
  AdminInvitationsPage,
  AdminInvitationsPageParams,
} from "@/lib/data/http/invitations.shared";

/** Server-side paginated invitations list with exact total + pending counts. */
export async function getAdminInvitationsPage(
  params?: AdminInvitationsPageParams,
): Promise<AdminInvitationsPage> {
  const qs = params ? buildAdminInvitationsSearchParams(params) : "";
  const res = await authedServerFetch(`/admin/invitations${qs ? `?${qs}` : ""}`);
  if (!res.ok) {
    throw new Error(`Failed to load invitations: ${res.status}`);
  }
  const body = (await res.json()) as {
    data: AdminInvitationWire[];
    total?: number;
    pendingTotal?: number;
    acceptedTotal?: number;
  };
  return parseAdminInvitationsPageBody(body);
}

/** Accurate count of pending invitations for the acting admin (nav badge / KPI). */
export async function getAdminInvitationsPendingCount(): Promise<number> {
  const { pendingTotal } = await getAdminInvitationsPage({ limit: 1, offset: 0 });
  return pendingTotal;
}
