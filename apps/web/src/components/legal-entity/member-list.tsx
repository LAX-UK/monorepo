"use client";

import { updateMemberRoleAction } from "@/lib/legal-entity/member-management.actions";
import type { MemberRowView } from "@/lib/legal-entity/member-row.vm";
import {
  ROLE_CHANGE_UNDO_MS,
  type RoleChangePorts,
  changeMemberRole,
} from "@/lib/legal-entity/role-change-flow";
import { notify } from "@/lib/ui/notify";
import type { LegalEntityMemberRole } from "@auction/types";
import { useEffect, useMemo, useRef, useState } from "react";
import { MemberRow } from "./members/member-row";
import { RemoveMemberDialog } from "./members/remove-member-dialog";
import { TransferOwnershipDialog } from "./members/transfer-ownership-dialog";

type Props = {
  legalEntityId: string;
  organisationName: string;
  rows: readonly MemberRowView[];
};

type OpenDialog =
  | { kind: "remove"; row: MemberRowView }
  | { kind: "transfer"; row: MemberRowView; confirmPhrase: string };

function withEntry<T>(map: Readonly<Record<string, T>>, key: string, value: T | null) {
  const next = { ...map };
  if (value === null) delete next[key];
  else next[key] = value;
  return next;
}

/**
 * The team as one list of rows. A role change applies from the picker, with a success toast and
 * Undo once the server agrees; removing someone and handing over ownership open a dialog.
 */
export function MemberList({ legalEntityId, organisationName, rows }: Props) {
  const [shown, setShown] = useState<Record<string, LegalEntityMemberRole>>({});
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const busyRef = useRef<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [dialog, setDialog] = useState<OpenDialog | null>(null);

  // Fresh rows from the server are the truth: drop what the pickers held, except mid-change.
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs when the server sends new rows.
  useEffect(() => {
    setShown((map) => {
      const kept = Object.entries(map).filter(([memberId]) => busyRef.current[memberId]);
      return kept.length === Object.keys(map).length ? map : Object.fromEntries(kept);
    });
  }, [rows]);

  const ports = useMemo<RoleChangePorts>(
    () => ({
      update: (memberId, role) => updateMemberRoleAction(legalEntityId, memberId, role),
      show: (memberId, role) => setShown((map) => withEntry(map, memberId, role)),
      busy: (memberId, value) => {
        busyRef.current = withEntry<boolean>(busyRef.current, memberId, value ? true : null);
        setBusy(busyRef.current);
      },
      rowError: (memberId, message) => setErrors((map) => withEntry(map, memberId, message)),
      toast: (copy, onUndo) => {
        const description = copy.description ? { description: copy.description } : {};
        if (onUndo) {
          notify.action(copy.title, {
            ...description,
            duration: ROLE_CHANGE_UNDO_MS,
            actionLabel: "Undo",
            onAction: onUndo,
          });
        } else {
          notify.success(copy.title, description);
        }
      },
    }),
    [legalEntityId],
  );

  return (
    <>
      <ul className="-my-3 divide-y divide-border-hairline">
        {rows.map((row) => (
          <MemberRow
            key={row.id}
            row={row}
            shownRole={shown[row.id] ?? row.role}
            busy={busy[row.id] ?? false}
            error={errors[row.id] ?? null}
            onRoleChange={(role) =>
              void changeMemberRole(
                ports,
                { id: row.id, name: row.name },
                shown[row.id] ?? row.role,
                role,
                organisationName,
              )
            }
            onTransfer={() =>
              row.transfer
                ? setDialog({ kind: "transfer", row, confirmPhrase: row.transfer.confirmPhrase })
                : undefined
            }
            onRemove={() => setDialog({ kind: "remove", row })}
          />
        ))}
      </ul>

      {dialog?.kind === "remove" ? (
        <RemoveMemberDialog
          legalEntityId={legalEntityId}
          organisationName={organisationName}
          member={{ id: dialog.row.id, name: dialog.row.name }}
          onClose={() => setDialog(null)}
        />
      ) : null}
      {dialog?.kind === "transfer" ? (
        <TransferOwnershipDialog
          legalEntityId={legalEntityId}
          organisationName={organisationName}
          member={{ id: dialog.row.id, name: dialog.row.name }}
          confirmPhrase={dialog.confirmPhrase}
          onClose={() => setDialog(null)}
        />
      ) : null}
    </>
  );
}
