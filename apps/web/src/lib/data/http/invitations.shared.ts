import type { InvitationListStatus } from "@/lib/admin/invitations-list-query";
import { isIndexableObject } from "@/lib/data/http/object-guards";
import type { UserRole, UserStaffRole } from "@auction/types";
import { z } from "zod";

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

export type AdminInvitationsListSummary = {
  total: number;
  pending: number;
  accepted: number;
};

export type AdminInvitationsPageParams = {
  limit: number;
  offset: number;
  status?: InvitationListStatus;
  q?: string;
};

export type AdminInvitationsPage = {
  rows: AdminInvitationSummary[];
  total: number;
  offset: number;
  limit: number;
  summary: AdminInvitationsListSummary;
  hasNextPage: boolean;
  /** @deprecated Use summary.pending */
  pendingTotal: number;
  /** @deprecated Use summary.accepted */
  acceptedTotal: number;
};

export const EMPTY_ADMIN_INVITATIONS_LIST_SUMMARY: AdminInvitationsListSummary = {
  total: 0,
  pending: 0,
  accepted: 0,
};

const rowSchema = z
  .object({
    id: z.coerce.string(),
    email: z.coerce.string(),
    targetRole: z.coerce.string(),
    targetStaffRole: z.union([z.null(), z.coerce.string()]).optional(),
    status: z.coerce.string(),
    expiresAt: z.coerce.string(),
    createdAt: z.coerce.string(),
    openedAt: z.union([z.null(), z.coerce.string()]).optional(),
    inviteEmailLastStatus: z.union([z.null(), z.coerce.string()]).optional(),
    invitedByName: z.union([z.null(), z.coerce.string()]).optional(),
  })
  .transform(
    (row): AdminInvitationWire => ({
      id: row.id,
      email: row.email,
      targetRole: row.targetRole,
      status: row.status,
      expiresAt: row.expiresAt,
      createdAt: row.createdAt,
      ...(row.targetStaffRole !== undefined ? { targetStaffRole: row.targetStaffRole } : {}),
      ...(row.openedAt !== undefined ? { openedAt: row.openedAt } : {}),
      ...(row.inviteEmailLastStatus !== undefined
        ? { inviteEmailLastStatus: row.inviteEmailLastStatus }
        : {}),
      ...(row.invitedByName !== undefined ? { invitedByName: row.invitedByName } : {}),
    }),
  );

const summarySchema = z.object({
  total: z.coerce.number().int().nonnegative(),
  pending: z.coerce.number().int().nonnegative(),
  accepted: z.coerce.number().int().nonnegative(),
});

function parseSummary(value: unknown): AdminInvitationsListSummary {
  const parsed = summarySchema.safeParse(value);
  if (!parsed.success) {
    throw new Error("Invalid invitations list summary in API response");
  }
  return parsed.data;
}

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

export function buildAdminInvitationsSearchParams(
  params: AdminInvitationsPageParams,
): URLSearchParams {
  const qs = new URLSearchParams({
    limit: String(params.limit),
    offset: String(params.offset),
  });
  if (params.status) qs.set("status", params.status);
  if (params.q) qs.set("q", params.q);
  return qs;
}

export function parseAdminInvitationsPageBody(
  body: unknown,
  params: AdminInvitationsPageParams,
): AdminInvitationsPage {
  const envelope = isIndexableObject(body) ? body : {};
  const rows = Array.isArray(envelope.data)
    ? envelope.data.map((row) => mapAdminInvitation(rowSchema.parse(row)))
    : [];
  const meta = isIndexableObject(envelope.meta) ? envelope.meta : {};
  const summary = parseSummary(meta.summary);
  const total = Number(meta.total);
  if (!Number.isFinite(total)) {
    throw new Error("Invalid invitations list total in API response");
  }
  const limit = Number(meta.limit ?? params.limit);
  const offset = Number(meta.offset ?? params.offset);
  return {
    rows,
    total,
    offset,
    limit,
    summary,
    hasNextPage: offset + rows.length < total,
    pendingTotal: summary.pending,
    acceptedTotal: summary.accepted,
  };
}
