import type { InvitationListStatus } from "@/lib/admin/invitations-list-query";
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

export type AdminInvitationWire = {
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

export function mapAdminInvitation(r: AdminInvitationWire): AdminInvitationSummary {
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

export function buildAdminInvitationsSearchParams(params: AdminInvitationsPageParams): string {
  const search = new URLSearchParams();
  search.set("limit", String(params.limit));
  search.set("offset", String(params.offset));
  if (params.status) search.set("status", params.status);
  if (params.q) search.set("q", params.q);
  return search.toString();
}

export function parseAdminInvitationsPageBody(body: {
  data: AdminInvitationWire[];
  total?: number;
  pendingTotal?: number;
  acceptedTotal?: number;
}): AdminInvitationsPage {
  const rows = body.data.map(mapAdminInvitation);
  return {
    rows,
    total: body.total ?? rows.length,
    pendingTotal: body.pendingTotal ?? rows.filter((r) => r.status === "pending").length,
    acceptedTotal: body.acceptedTotal ?? rows.filter((r) => r.status === "accepted").length,
  };
}
