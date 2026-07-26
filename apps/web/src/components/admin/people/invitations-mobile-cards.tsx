"use client";

import { useAdminBulkSelectionBulk } from "@/components/admin/admin-bulk-selection-bridge";
import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { InvitationExpiryCountdown } from "@/components/admin/invitation-expiry-countdown";
import { InvitationRowActions } from "@/components/admin/invitation-row-actions";
import { PlatformRoleBadge } from "@/components/admin/platform-role-badge";
import { invitationLifecycleDisplay } from "@/lib/admin/invite-lifecycle";
import type { AdminInvitationSummary } from "@/lib/data/http/invitations.server";
import { formatDateTime, formatRelativeTime } from "@/lib/ui/format";
import { Checkbox } from "@auction/ui/components/checkbox";

function coerceDate(d: Date | string): Date {
  return d instanceof Date ? d : new Date(d);
}

type Props = {
  rows: AdminInvitationSummary[];
};

export function InvitationsMobileCards({ rows }: Props) {
  const bulk = useAdminBulkSelectionBulk();

  return (
    <ul className="space-y-3">
      {rows.map((r) => {
        const expiresAt = coerceDate(r.expiresAt);
        const openedAt = r.openedAt ? coerceDate(r.openedAt) : null;
        const createdAt = coerceDate(r.createdAt);
        const display = invitationLifecycleDisplay({
          status: r.status,
          expiresAt,
          openedAt,
          inviteEmailLastStatus: r.inviteEmailLastStatus,
        });

        const card = (
          <div className="min-w-0 flex-1 rounded-lg border border-outline-variant/20 bg-surface-container-lowest p-4">
            <p className="truncate font-medium text-on-surface">{r.email}</p>
            <div className="mt-1">
              <PlatformRoleBadge targetRole={r.targetRole} targetStaffRole={r.targetStaffRole} />
            </div>
            {r.invitedByName ? (
              <p className="mt-1 text-xs text-on-surface-variant">Invited by {r.invitedByName}</p>
            ) : null}
            <p className="mt-1 text-xs text-on-surface-variant">
              Sent {formatRelativeTime(createdAt)} · {formatDateTime(createdAt)}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {display.kind === "revoked" ? (
                <AdminStatusBadge domain="invitation" status="revoked" />
              ) : (
                <AdminStatusBadge domain="inviteLifecycle" status={display.pill} size="sm" />
              )}
              <InvitationExpiryCountdown
                expiresAt={expiresAt}
                active={r.status === "pending" && expiresAt.getTime() > Date.now()}
              />
            </div>
            <div className="mt-3">
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
          </div>
        );

        if (!bulk) {
          return (
            <li key={r.id} className="flex gap-3">
              {card}
            </li>
          );
        }

        return (
          <li key={r.id} className="flex items-start gap-3">
            <Checkbox
              checked={bulk.isSelected(r.id)}
              onCheckedChange={(checked) => bulk.toggleSelected(r.id, checked === true)}
              aria-label={`Select invitation for ${r.email}`}
              className="mt-4"
            />
            {card}
          </li>
        );
      })}
    </ul>
  );
}
