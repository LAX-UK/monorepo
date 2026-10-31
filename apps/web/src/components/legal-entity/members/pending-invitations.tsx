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
import { RecordList, RecordRow } from "@auction/ui";
import {
  Button,
  Menu,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuTrigger,
  StatusBadge,
} from "@auction/ui/lax";
import { Ellipsis, Mail, RotateCw, X } from "lucide-react";
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
  const [gone, setGone] = useState<ReadonlySet<string>>(new Set());

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
    setGone((ids) => new Set(ids).add(row.id));
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
          if (restored.ok) {
            setGone((ids) => {
              const next = new Set(ids);
              next.delete(row.id);
              return next;
            });
            notify.success(invitationCopy.reopened(row.email).title);
          } else notify.error(restored.error);
        })();
      },
    });
  }

  return (
    <RecordList aria-label="Invitations">
      {rows
        .filter((row) => !gone.has(row.id))
        .map((row) => (
          <RecordRow
            key={row.id}
            leading={
              <MemberInitials>
                <Mail className="size-4" strokeWidth={1.75} />
              </MemberInitials>
            }
            title={row.email}
            meta={row.detail}
            status={
              row.expired ? (
                <StatusBadge tone="warning" shape="alert">
                  Expired
                </StatusBadge>
              ) : null
            }
            action={
              row.canManage ? (
                <Button size="sm" loading={busy === row.id} onClick={() => void resend(row)}>
                  Resend
                </Button>
              ) : null
            }
            menu={
              row.canManage ? (
                <Menu>
                  <MenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-md"
                      aria-label={`More for the invitation to ${row.email}`}
                    >
                      <Ellipsis aria-hidden />
                    </Button>
                  </MenuTrigger>
                  <MenuContent className="w-56">
                    <MenuItem disabled={busy === row.id} onSelect={() => void resend(row)}>
                      <RotateCw aria-hidden />
                      Resend
                    </MenuItem>
                    <MenuSeparator />
                    <MenuItem
                      tone="danger"
                      disabled={busy === row.id}
                      onSelect={() => void withdraw(row)}
                    >
                      <X aria-hidden />
                      {row.expired ? "Remove" : "Withdraw"}
                    </MenuItem>
                  </MenuContent>
                </Menu>
              ) : null
            }
            detail={
              errors[row.id] ? (
                <p role="alert" className="text-lax-12 font-medium text-lax-danger">
                  {errors[row.id]}
                </p>
              ) : null
            }
          />
        ))}
    </RecordList>
  );
}
