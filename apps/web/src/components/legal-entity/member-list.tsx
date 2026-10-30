"use client";

import { LeaveOrganisationDialog } from "@/components/organisation-team/leave-organisation-dialog";
import { TeamListNoResults } from "@/components/organisation-team/team-list-states";
import { updateMemberRoleAction } from "@/lib/legal-entity/member-management.actions";
import type { MemberRowView } from "@/lib/legal-entity/member-row.vm";
import {
  ROLE_CHANGE_UNDO_MS,
  type RoleChangePorts,
  changeMemberRole,
} from "@/lib/legal-entity/role-change-flow";
import {
  type MemberRoleFilter,
  filterMemberRows,
  memberRoleFilterOptions,
} from "@/lib/organisation-team/member-filter";
import { notify } from "@/lib/ui/notify";
import type { LegalEntityMemberRole } from "@auction/types";
import { RecordList } from "@auction/ui";
import { ListSearch, SelectMenu } from "@auction/ui/lax";
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
  | { kind: "transfer"; row: MemberRowView; confirmPhrase: string }
  | { kind: "leave" };

function withEntry<T>(map: Readonly<Record<string, T>>, key: string, value: T | null) {
  const next = { ...map };
  if (value === null) delete next[key];
  else next[key] = value;
  return next;
}

/**
 * The team: search by name or email and a role filter, then one row per person. A role change
 * applies from the picker, with a success toast and Undo once the server agrees; removing
 * someone, handing over ownership and leaving open a dialog. A dialog opens after the row's menu
 * has closed, so the menu handing focus back never closes it.
 */
export function MemberList({ legalEntityId, organisationName, rows }: Props) {
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<MemberRoleFilter>("all");
  const [shown, setShown] = useState<Record<string, LegalEntityMemberRole>>({});
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const busyRef = useRef<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [dialog, setDialog] = useState<OpenDialog | null>(null);
  // Who the server has removed, hidden at once: the refreshed list follows, but the row does not
  // wait for it to say what the server already confirmed.
  const [removed, setRemoved] = useState<ReadonlySet<string>>(new Set());

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

  const open = (next: OpenDialog) => window.setTimeout(() => setDialog(next), 0);
  const present = rows.filter((row) => !removed.has(row.id));
  const visible = filterMemberRows(present, { query, role: roleFilter });
  const filtering = query.trim() !== "" || roleFilter !== "all";

  return (
    <div className="flex flex-col gap-4">
      {present.length > 1 ? (
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <div className="flex min-w-0 md:max-w-[340px] md:flex-1">
            <ListSearch
              value={query}
              onValueChange={setQuery}
              placeholder="Search by name or email"
            />
          </div>
          <SelectMenu
            label="Role"
            value={roleFilter}
            onValueChange={setRoleFilter}
            options={memberRoleFilterOptions(present)}
            className="w-full md:w-44"
          />
        </div>
      ) : null}

      {visible.length === 0 && filtering ? (
        <TeamListNoResults
          query={query.trim()}
          onClear={() => {
            setQuery("");
            setRoleFilter("all");
          }}
        />
      ) : (
        <RecordList aria-label={`Members of ${organisationName}`}>
          {visible.map((row) => (
            <MemberRow
              key={row.id}
              row={row}
              organisationName={organisationName}
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
              onTransfer={() => {
                if (row.transfer) {
                  open({ kind: "transfer", row, confirmPhrase: row.transfer.confirmPhrase });
                }
              }}
              onRemove={() => open({ kind: "remove", row })}
              onLeave={() => open({ kind: "leave" })}
            />
          ))}
        </RecordList>
      )}

      {dialog?.kind === "remove" ? (
        <RemoveMemberDialog
          legalEntityId={legalEntityId}
          organisationName={organisationName}
          member={{ id: dialog.row.id, name: dialog.row.name }}
          onRemoved={() => setRemoved((ids) => new Set(ids).add(dialog.row.id))}
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
      {dialog?.kind === "leave" ? (
        <LeaveOrganisationDialog
          legalEntityId={legalEntityId}
          organisationName={organisationName}
          onClose={() => setDialog(null)}
        />
      ) : null}
    </div>
  );
}
