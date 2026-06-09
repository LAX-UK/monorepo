import "server-only";

import type { InvitationListStatus } from "@/lib/admin/invitations-list-query";
import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import type { UserRole, UserStaffRole } from "@auction/types";

export type AdminInvitationSummary = {
  id: string;
  email: string;
  targetRole: UserRole;
  targetStaffRole: UserStaffRole | null;
  status: string;
  expiresAt: Date;
  createdAt: Date;
  openedAt: Date | null;
  inviteEmailLastStatus: string | null;
  invitedByName: string | null;
};

type AdminInvitationWire = {
  id: string;
  email: string;
  targetRole: string;
  targetStaffRole?: string | null;
  status: string;
  expiresAt: string;
  createdAt: string;
  openedAt?: string | null;
  inviteEmailLastStatus?: string | null;
  invitedByName?: string | null;
};

function mapInvitation(r: AdminInvitationWire): AdminInvitationSummary {
  return {
    id: r.id,
    email: r.email,
    targetRole: r.targetRole as UserRole,
    targetStaffRole: (r.targetStaffRole ?? null) as UserStaffRole | null,
    status: r.status,
    expiresAt: new Date(r.expiresAt),
    createdAt: new Date(r.createdAt),
    openedAt: r.openedAt ? new Date(r.openedAt) : null,
    inviteEmailLastStatus: r.inviteEmailLastStatus ?? null,
    invitedByName: r.invitedByName ?? null,
  };
}

export type AdminInvitationsPage = {
  rows: AdminInvitationSummary[];
  total: number;
  pendingTotal: number;
  acceptedTotal: number;
};

export type AdminInvitationsPageParams = {
  limit: number;
  offset: number;
  status?: InvitationListStatus;
  q?: string;
};

/** Server-side paginated invitations list with exact total + pending counts. */
export async function getAdminInvitationsPage(
  params?: AdminInvitationsPageParams,
): Promise<AdminInvitationsPage> {
  const search = new URLSearchParams();
  if (params) {
    search.set("limit", String(params.limit));
    search.set("offset", String(params.offset));
    if (params.status) search.set("status", params.status);
    if (params.q) search.set("q", params.q);
  }
  const qs = search.toString();
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
  const rows = body.data.map(mapInvitation);
  return {
    rows,
    total: body.total ?? rows.length,
    pendingTotal: body.pendingTotal ?? rows.filter((r) => r.status === "pending").length,
    acceptedTotal: body.acceptedTotal ?? rows.filter((r) => r.status === "accepted").length,
  };
}

/** Accurate count of pending invitations for the acting admin (nav badge / KPI). */
export async function getAdminInvitationsPendingCount(): Promise<number> {
  const { pendingTotal } = await getAdminInvitationsPage({ limit: 1, offset: 0 });
  return pendingTotal;
}
