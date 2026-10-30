"use client";

import { invitationCopy } from "@/lib/legal-entity/member-change-copy";
import {
  inviteMemberAction,
  restoreInvitationAction,
  withdrawInvitationAction,
} from "@/lib/legal-entity/member-management.actions";
import type { InvitationRowView } from "@/lib/legal-entity/member-row.vm";
import { ROLE_CHANGE_UNDO_MS } from "@/lib/legal-entity/role-change-flow";
import { notify } from "@/lib/ui/notify";
import { InlineActionMenu } from "@auction/ui";
import { StatusBadge } from "@auction/ui/components/status-badge";
import { Mail } from "lucide-react";
import { useState } from "react";
import { MemberInitials } from "./member-initials";

type Props = {
  legalEntityId: string;
  rows: readonly InvitationRowView[];
};

/**
 * Invitations nobody has answered yet, with their role, when they were sent and when they
 * expire. Resend sends a fresh link (the old one stops working). Withdraw closes an open link
 * at once, with Undo for 10 seconds; Remove clears an expired one.
 */
export function PendingInvitations({ legalEntityId, rows }: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function run(row: InvitationRowView, task: () => Promise<{ ok: boolean; error?: string }>) {
    setBusy(row.id);
    setErrors(({ [row.id]: _cleared, ...rest }) => rest);
    const result = await task();
    setBusy(null);
    if (!result.ok) setErrors((map) => ({ ...map, [row.id]: result.error ?? "" }));
    return result.ok;
  }

  async function resend(row: InvitationRowView) {
    const ok = await run(row, () => inviteMemberAction(legalEntityId, row.email, row.role));
    if (!ok) return;
    const copy = invitationCopy.resent(row.email);
    notify.success(copy.title, copy.description ? { description: copy.description } : undefined);
  }

  async function withdraw(row: InvitationRowView) {
    const ok = await run(row, () => withdrawInvitationAction(legalEntityId, row.id));
    if (!ok) return;
    // An expired link cannot be reopened, so removing it offers no Undo.
    if (row.expired) {
      notify.success(invitationCopy.removed(row.email).title);
      return;
    }
    notify.action(invitationCopy.withdrawn(row.email).title, {
      duration: ROLE_CHANGE_UNDO_MS,
      actionLabel: "Undo",
      onAction: () => {
        void (async () => {
          const restored = await restoreInvitationAction(legalEntityId, row.id);
          if (restored.ok) notify.success(invitationCopy.reopened(row.email).title);
          else notify.error(restored.error);
        })();
      },
    });
  }

  return (
    <ul className="-my-3 divide-y divide-border-hairline">
      {rows.map((row) => (
        <li
          key={row.id}
          className="grid grid-cols-[2rem_minmax(0,1fr)_2.75rem] items-center gap-x-3 gap-y-1 py-3 sm:grid-cols-[2rem_minmax(0,1fr)_auto_2.5rem]"
          aria-busy={busy === row.id || undefined}
          data-testid={`invitation-row-${row.id}`}
        >
          <MemberInitials>
            <Mail className="size-4" strokeWidth={1.75} />
          </MemberInitials>
          <div className="min-w-0">
            <p className="truncate font-body text-sm leading-5.5 font-medium text-on-surface">
              {row.email}
            </p>
            <p className="flex flex-wrap gap-x-1.5 font-body text-label-3 leading-5 text-on-surface-variant">
              <span className="whitespace-nowrap">{row.detail[0]}</span>
              <span aria-hidden className="hidden sm:inline">
                ·
              </span>
              <span className="whitespace-nowrap">{row.detail[1]}</span>
            </p>
          </div>
          {row.expired ? (
            <div className="col-start-2 row-start-2 sm:col-start-3 sm:row-start-1">
              <StatusBadge tone="warning">Expired</StatusBadge>
            </div>
          ) : null}
          <div className="col-start-3 row-start-1 flex justify-end sm:col-start-4">
            {row.canManage ? (
              <InlineActionMenu
                label={`More for the invitation to ${row.email}`}
                items={[
                  {
                    type: "item",
                    label: "Resend",
                    onSelect: () => void resend(row),
                    disabled: busy === row.id,
                  },
                  { type: "separator" },
                  {
                    type: "item",
                    label: row.expired ? "Remove" : "Withdraw",
                    onSelect: () => void withdraw(row),
                    disabled: busy === row.id,
                    destructive: true,
                  },
                ]}
              />
            ) : null}
          </div>
          {errors[row.id] ? (
            <p
              role="alert"
              className="col-start-2 col-end-[-1] font-body text-label-3 leading-5 text-error"
            >
              {errors[row.id]}
            </p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
