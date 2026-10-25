import { buildListHref } from "@/lib/admin/admin-list-params";
import { defineListSort } from "@/lib/admin/define-list-sort";
import {
  invitationCanResend,
  invitationCanRevoke,
  invitationLifecycleDisplay,
  invitationResendDisabledReason,
  invitationRevokeDisabledReason,
} from "@/lib/admin/invite-lifecycle";
import { INVITATIONS_LIST_PATH } from "@/lib/admin/people/build-invitations-list-page-model";
import type { AdminInvitationSummary } from "@/lib/data/http/invitations.shared";
import type { StatusPresentation } from "@auction/staff-ui";
import type { LaxStaffGrant, UserRole, UserStaffRole } from "@auction/types";

export type InvitationsListSearch = Record<string, string | string[] | undefined>;

/** One invitation as the staff list shows it; plain data (ISO times) for the client component. */
export type InvitationStaffRow = {
  id: string;
  email: string;
  targetRole: UserRole;
  targetStaffRole: UserStaffRole | null;
  grants: LaxStaffGrant[];
  status: StatusPresentation;
  invitedBy: string | null;
  sentAt: string;
  openedAt: string | null;
  expiresAt: string;
  /** "Delivered", "Bounced"; null when the email service has not reported. */
  delivery: string | null;
  /** Why it cannot be resent now, or null when it can. */
  resendBlocked: string | null;
  /** Why it cannot be revoked now, or null when it can. */
  revokeBlocked: string | null;
};

const LIFECYCLE: Record<string, StatusPresentation> = {
  sent: { label: "Sent", tone: "info" },
  opened: { label: "Opened", tone: "info" },
  accepted: { label: "Accepted", tone: "success" },
  expired: { label: "Expired", tone: "neutral" },
  bounced: { label: "Email bounced", tone: "danger" },
};

const DELIVERY: Record<string, string> = {
  sent: "Sent",
  delivered: "Delivered",
  failed: "Bounced",
  suppressed: "Blocked by the address's mail server",
};

export function invitationStatus(row: AdminInvitationSummary): StatusPresentation {
  const display = invitationLifecycleDisplay(row);
  if (display.kind === "revoked") return { label: "Revoked", tone: "neutral" };
  return LIFECYCLE[display.pill] ?? { label: "Sent", tone: "info" };
}

export function toInvitationStaffRows(
  rows: readonly AdminInvitationSummary[],
): InvitationStaffRow[] {
  return rows.map((row) => ({
    id: row.id,
    email: row.email,
    targetRole: row.targetRole,
    targetStaffRole: row.targetStaffRole,
    grants: row.grants,
    status: invitationStatus(row),
    invitedBy: row.invitedByName,
    sentAt: row.createdAt.toISOString(),
    openedAt: row.openedAt ? row.openedAt.toISOString() : null,
    expiresAt: row.expiresAt.toISOString(),
    delivery: row.inviteEmailLastStatus ? (DELIVERY[row.inviteEmailLastStatus] ?? null) : null,
    resendBlocked: invitationCanResend(row) ? null : invitationResendDisabledReason(row),
    revokeBlocked: invitationCanRevoke(row) ? null : invitationRevokeDisabledReason(row),
  }));
}

export function invitationsListHref(
  current: InvitationsListSearch,
  patch: Record<string, string | number | null | undefined>,
): string {
  return buildListHref(INVITATIONS_LIST_PATH, current, {
    offset: 0,
    invitation: null,
    invite: null,
    error: null,
    ...patch,
  });
}

/** The list with this invitation's panel open (`?invitation=`), or closed for null. */
export function invitationPanelHref(current: InvitationsListSearch, id: string | null): string {
  return buildListHref(INVITATIONS_LIST_PATH, current, { invitation: id, invite: null });
}

/** Most recently sent first, unless the person sorts by email or expiry. */
export const invitationsSort = defineListSort(
  {
    email: { asc: "email_asc", desc: "email_desc" },
    expires: { asc: "expires_asc", desc: "expires_desc" },
    sent: { asc: "created_asc", desc: "created_desc" },
  },
  "created_desc",
);
