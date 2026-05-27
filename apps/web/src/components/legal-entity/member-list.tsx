"use client";

import { TypedConfirmationDialog } from "@/components/admin/typed-confirmation-dialog";
import {
  type MemberRow,
  removeMemberAction,
  transferPrimaryAdminAction,
  updateMemberRoleAction,
} from "@/lib/legal-entity/member-management.actions";
import type { LegalEntityMemberRole } from "@auction/types";
import { legalEntityMemberRoles } from "@auction/types";
import { Button } from "@auction/ui/components/button";
import { ConfirmDialog } from "@auction/ui/components/confirm-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@auction/ui/components/select";
import { Loader2 } from "lucide-react";
import { useState, useTransition } from "react";

type Props = {
  legalEntityId: string;
  members: MemberRow[];
  /** True when the current viewer holds a role in {owner, admin}. */
  viewerIsAdmin: boolean;
  /** True when the current viewer is the primary admin. */
  viewerIsPrimaryAdmin: boolean;
  /** Current viewer's user.id, used to disable self-targeting actions. */
  viewerUserId: string;
};

type PendingDialog =
  | { kind: "remove"; memberId: string; phrase: string }
  | { kind: "transfer"; memberId: string; phrase: string };

function needsTypedRemove(role: LegalEntityMemberRole): boolean {
  return role === "owner" || role === "admin";
}

export function MemberList({
  legalEntityId,
  members,
  viewerIsAdmin,
  viewerIsPrimaryAdmin,
  viewerUserId,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<PendingDialog | null>(null);
  const [simpleRemove, setSimpleRemove] = useState<{ memberId: string; memberName: string } | null>(
    null,
  );

  function handleRoleChange(memberId: string, role: LegalEntityMemberRole) {
    setError(null);
    startTransition(async () => {
      const res = await updateMemberRoleAction(legalEntityId, memberId, role);
      if (!res.ok) setError(res.error);
    });
  }

  function handleRemoveClick(m: MemberRow) {
    setError(null);
    if (needsTypedRemove(m.role)) {
      setDialog({
        kind: "remove",
        memberId: m.id,
        phrase: `REMOVE ${m.user.name}`,
      });
      return;
    }
    setSimpleRemove({ memberId: m.id, memberName: m.user.name });
  }

  function handleTransferClick(m: MemberRow) {
    setError(null);
    setDialog({
      kind: "transfer",
      memberId: m.id,
      phrase: `TRANSFER PRIMARY TO ${m.user.name}`,
    });
  }

  return (
    <div className="space-y-3">
      {error && <p className="text-sm text-destructive">{error}</p>}
      <ul className="divide-y rounded-md border bg-surface">
        {members.map((m) => {
          const isSelf = m.userId === viewerUserId;
          const canEdit = viewerIsAdmin && !m.isPrimaryAdmin && !isSelf;
          const canTransfer = viewerIsPrimaryAdmin && !m.isPrimaryAdmin;
          const pendingInvitation = !m.acceptedAt;
          return (
            <li key={m.id} className="flex flex-wrap items-center gap-3 p-3 sm:flex-nowrap">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{m.user.name}</p>
                <p className="truncate text-xs text-on-surface-variant">
                  {m.user.email}
                  {pendingInvitation ? " · pending invite" : ""}
                  {m.isPrimaryAdmin ? " · primary admin" : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {canEdit ? (
                  <Select
                    value={m.role}
                    onValueChange={(v) => handleRoleChange(m.id, v as LegalEntityMemberRole)}
                  >
                    <SelectTrigger className="w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {legalEntityMemberRoles.map((role) => (
                        <SelectItem key={role} value={role}>
                          {role}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <span className="rounded-full border px-2 py-0.5 text-xs">{m.role}</span>
                )}
                {canTransfer && (
                  <Button
                    type="button"
                    variant="tertiary"
                    onClick={() => handleTransferClick(m)}
                    disabled={pending}
                  >
                    Make primary
                  </Button>
                )}
                {canEdit && (
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => handleRemoveClick(m)}
                    disabled={pending}
                  >
                    Remove
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {pending && (
        <p className="flex items-center gap-2 text-xs text-on-surface-variant">
          <Loader2 className="size-3 animate-spin" /> Saving…
        </p>
      )}

      {dialog ? (
        <TypedConfirmationDialog
          open
          onOpenChange={(o) => {
            if (!o) setDialog(null);
          }}
          title={dialog.kind === "transfer" ? "Transfer primary admin" : "Remove member"}
          description={
            dialog.kind === "transfer"
              ? "You will be demoted to admin. This cannot be undone without the new primary admin."
              : "This removes the member from the organisation."
          }
          actionLabel={dialog.kind === "transfer" ? "Transfer primary" : "Remove member"}
          confirmationPhrase={dialog.phrase}
          severity="danger"
          onConfirm={async () => {
            const d = dialog;
            setError(null);
            if (d.kind === "remove") {
              const res = await removeMemberAction(legalEntityId, d.memberId, {
                confirmationPhrase: d.phrase,
              });
              if (!res.ok) throw new Error(res.error);
              return;
            }
            const res = await transferPrimaryAdminAction(legalEntityId, d.memberId, d.phrase);
            if (!res.ok) throw new Error(res.error);
          }}
        />
      ) : null}
      {simpleRemove ? (
        <ConfirmDialog
          open
          onOpenChange={(open) => {
            if (!open) setSimpleRemove(null);
          }}
          title="Remove member"
          body={`Remove ${simpleRemove.memberName} from this organisation?`}
          confirmLabel="Remove"
          tone="danger"
          loading={pending}
          onConfirm={() => {
            const target = simpleRemove;
            setSimpleRemove(null);
            startTransition(async () => {
              const res = await removeMemberAction(legalEntityId, target.memberId);
              if (!res.ok) setError(res.error);
            });
          }}
        />
      ) : null}
    </div>
  );
}
