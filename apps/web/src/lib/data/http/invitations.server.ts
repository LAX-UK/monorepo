import "server-only";

import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import type { UserRole } from "@auction/types";

export type AdminInvitationSummary = {
  id: string;
  email: string;
  targetRole: UserRole;
  status: string;
  expiresAt: Date;
  createdAt: Date;
  openedAt: Date | null;
  inviteEmailLastStatus: string | null;
};

type AdminInvitationWire = {
  id: string;
  email: string;
  targetRole: string;
  status: string;
  expiresAt: string;
  createdAt: string;
  openedAt?: string | null;
  inviteEmailLastStatus?: string | null;
};

function mapInvitation(r: AdminInvitationWire): AdminInvitationSummary {
  return {
    id: r.id,
    email: r.email,
    targetRole: r.targetRole as UserRole,
    status: r.status,
    expiresAt: new Date(r.expiresAt),
    createdAt: new Date(r.createdAt),
    openedAt: r.openedAt ? new Date(r.openedAt) : null,
    inviteEmailLastStatus: r.inviteEmailLastStatus ?? null,
  };
}

export type AdminInvitationsPage = {
  rows: AdminInvitationSummary[];
  total: number;
  pendingTotal: number;
};

/** Server-side paginated invitations list with exact total + pending counts. */
export async function getAdminInvitationsPage(pagination?: {
  limit: number;
  offset: number;
}): Promise<AdminInvitationsPage> {
  const params = new URLSearchParams();
  if (pagination) {
    params.set("limit", String(pagination.limit));
    params.set("offset", String(pagination.offset));
  }
  const qs = params.toString();
  const res = await authedServerFetch(`/admin/invitations${qs ? `?${qs}` : ""}`);
  if (!res.ok) {
    throw new Error(`Failed to load invitations: ${res.status}`);
  }
  const body = (await res.json()) as {
    data: AdminInvitationWire[];
    total?: number;
    pendingTotal?: number;
  };
  const rows = body.data.map(mapInvitation);
  return {
    rows,
    total: body.total ?? rows.length,
    pendingTotal: body.pendingTotal ?? rows.filter((r) => r.status === "pending").length,
  };
}

/** Accurate count of pending invitations for the acting admin (nav badge / KPI). */
export async function getAdminInvitationsPendingCount(): Promise<number> {
  const { pendingTotal } = await getAdminInvitationsPage({ limit: 1, offset: 0 });
  return pendingTotal;
}
