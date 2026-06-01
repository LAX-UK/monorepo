"use client";

import { useAdminBulkSelectionBulk } from "@/components/admin/admin-bulk-selection-bridge";
import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { InvitationExpiryCountdown } from "@/components/admin/invitation-expiry-countdown";
import { InvitationRevokeButton } from "@/components/admin/invitation-revoke-button";
import { adminResendInvitationAction } from "@/lib/actions/admin";
import {
  invitationCanResendOrRevoke,
  invitationLifecycleDisplay,
} from "@/lib/admin/invite-lifecycle";
import type { AdminInvitationSummary } from "@/lib/data/http/invitations.server";
import type { UserRole } from "@auction/types";
import { Button } from "@auction/ui/components/button";
import { Checkbox } from "@auction/ui/components/checkbox";

function roleLabel(r: UserRole): string {
  if (r === "staff") return "Staff";
  return "Client";
}

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
        const display = invitationLifecycleDisplay({
          status: r.status,
          expiresAt,
          openedAt,
          inviteEmailLastStatus: r.inviteEmailLastStatus,
        });
        const canMutate = invitationCanResendOrRevoke({
          status: r.status,
          expiresAt,
          openedAt,
          inviteEmailLastStatus: r.inviteEmailLastStatus,
        });

        const card = (
          <div className="min-w-0 flex-1 rounded-lg border border-outline-variant/20 bg-surface-container-lowest p-4">
            <p className="truncate font-medium text-on-surface">{r.email}</p>
            <p className="mt-1 text-xs text-on-surface-variant">{roleLabel(r.targetRole)}</p>
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
            <div className="mt-3 flex flex-wrap gap-2">
              <form action={adminResendInvitationAction}>
                <input type="hidden" name="invitationId" value={r.id} />
                <Button
                  type="submit"
                  variant="outline"
                  size="sm"
                  disabled={!canMutate}
                  className="font-label text-[10px] uppercase"
                >
                  Resend
                </Button>
              </form>
              <InvitationRevokeButton invitationId={r.id} disabled={!canMutate} />
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
