"use client";

import type { MemberRowView } from "@/lib/legal-entity/member-row.vm";
import type { LegalEntityMemberRole } from "@auction/types";
import { InlineActionMenu, type InlineActionMenuItem } from "@auction/ui";
import { LabelledSelect } from "@auction/ui/components/labelled-select";
import { MemberInitials } from "./member-initials";

type Props = {
  row: MemberRowView;
  /** The role the picker shows (the saved one, or one the server is deciding on). */
  shownRole: LegalEntityMemberRole;
  busy: boolean;
  error: string | null;
  onRoleChange: (role: LegalEntityMemberRole) => void;
  onTransfer: () => void;
  onRemove: () => void;
};

/**
 * One member: initials, name, email and two-step sign-in, the role (a picker when the viewer may
 * change it), and a "…" menu with what else they may do. On phones the role sits under the
 * name, so nothing runs past the card edge.
 */
export function MemberRow({
  row,
  shownRole,
  busy,
  error,
  onRoleChange,
  onTransfer,
  onRemove,
}: Props) {
  const menu: InlineActionMenuItem[] = [
    ...(row.transfer
      ? [{ type: "item" as const, label: "Transfer ownership", onSelect: onTransfer }]
      : []),
    ...(row.transfer && row.canRemove ? [{ type: "separator" as const }] : []),
    ...(row.canRemove
      ? [{ type: "item" as const, label: "Remove", onSelect: onRemove, destructive: true }]
      : []),
  ];

  return (
    <li
      className="grid grid-cols-[2rem_minmax(0,1fr)_2.75rem] items-center gap-x-3 gap-y-2 py-3 sm:grid-cols-[2rem_minmax(0,1fr)_11rem_2.5rem]"
      data-testid={`member-row-${row.id}`}
      aria-busy={busy || undefined}
    >
      <MemberInitials>{row.initials}</MemberInitials>
      <div className="min-w-0">
        <p className="truncate font-body text-sm leading-5.5 font-medium text-on-surface">
          {row.name}
          {row.isYou ? <span className="font-normal text-on-surface-variant"> (you)</span> : null}
        </p>
        <p className="flex min-w-0 flex-wrap gap-x-1.5 font-body text-label-3 leading-5 text-on-surface-variant">
          <span className="min-w-0 truncate">{row.email}</span>
          {row.twoStep ? (
            <>
              <span aria-hidden>·</span>
              <span className="whitespace-nowrap">{row.twoStep}</span>
            </>
          ) : null}
        </p>
      </div>
      <div className="col-start-2 row-start-2 sm:col-start-3 sm:row-start-1">
        {row.roleOptions ? (
          <LabelledSelect
            aria-label={`Role for ${row.name}`}
            options={row.roleOptions}
            value={shownRole}
            onValueChange={onRoleChange}
            disabled={busy}
            triggerClassName="w-full sm:w-44"
          />
        ) : (
          <p className="font-body text-sm leading-5.5 text-on-surface sm:px-3">{row.roleLabel}</p>
        )}
      </div>
      <div className="col-start-3 row-start-1 flex justify-end sm:col-start-4">
        {menu.length > 0 ? <InlineActionMenu items={menu} label={`More for ${row.name}`} /> : null}
      </div>
      {error ? (
        <p
          role="alert"
          className="col-start-2 col-end-[-1] font-body text-label-3 leading-5 text-error"
        >
          {error}
        </p>
      ) : null}
    </li>
  );
}
