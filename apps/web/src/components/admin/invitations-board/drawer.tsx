"use client";

import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { InvitationExpiryCountdown } from "@/components/admin/invitation-expiry-countdown";
import { InvitationRowActions } from "@/components/admin/invitation-row-actions";
import { invitationRoleLabel } from "@/lib/admin/invitation-role-label";
import { invitationLifecycleDisplay } from "@/lib/admin/invite-lifecycle";
import type { AdminInvitationSummary } from "@/lib/data/http/invitations.server";
import { formatDateTime, formatRelativeTime } from "@/lib/ui/format";

function coerceDate(d: Date | string): Date {
  return d instanceof Date ? d : new Date(d);
}

type Props = {
  invitation: AdminInvitationSummary;
};

export function InvitationDrawerContent({ invitation: r }: Props) {
  const expiresAt = coerceDate(r.expiresAt);
  const openedAt = r.openedAt ? coerceDate(r.openedAt) : null;
  const createdAt = coerceDate(r.createdAt);
  const display = invitationLifecycleDisplay({
    status: r.status,
    expiresAt,
    openedAt,
    inviteEmailLastStatus: r.inviteEmailLastStatus,
  });

  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-1 gap-3 text-sm">
        <div>
          <dt className="font-label text-[10px] uppercase text-on-surface-variant">Email</dt>
          <dd className="mt-1 break-all">{r.email}</dd>
        </div>
        <div>
          <dt className="font-label text-[10px] uppercase text-on-surface-variant">Role</dt>
          <dd className="mt-1">{invitationRoleLabel(r.targetRole, r.targetStaffRole)}</dd>
        </div>
        <div>
          <dt className="font-label text-[10px] uppercase text-on-surface-variant">Status</dt>
          <dd className="mt-1">
            {display.kind === "revoked" ? (
              <AdminStatusBadge domain="invitation" status="revoked" />
            ) : (
              <AdminStatusBadge domain="inviteLifecycle" status={display.pill} size="sm" />
            )}
          </dd>
        </div>
        <div>
          <dt className="font-label text-[10px] uppercase text-on-surface-variant">Sent</dt>
          <dd className="mt-1">
            {formatRelativeTime(createdAt)}
            <span className="mt-0.5 block text-xs text-on-surface-variant">
              {formatDateTime(createdAt)}
            </span>
          </dd>
        </div>
        {r.invitedByName ? (
          <div>
            <dt className="font-label text-[10px] uppercase text-on-surface-variant">Invited by</dt>
            <dd className="mt-1">{r.invitedByName}</dd>
          </div>
        ) : null}
        <div>
          <dt className="font-label text-[10px] uppercase text-on-surface-variant">Expires</dt>
          <dd className="mt-1">
            <InvitationExpiryCountdown
              expiresAt={expiresAt}
              active={r.status === "pending" && expiresAt.getTime() > Date.now()}
            />
          </dd>
        </div>
      </dl>
      <InvitationRowActions
        invitationId={r.id}
        lifecycle={{
          status: r.status,
          expiresAt,
          openedAt,
          inviteEmailLastStatus: r.inviteEmailLastStatus,
        }}
      />
    </div>
  );
}
