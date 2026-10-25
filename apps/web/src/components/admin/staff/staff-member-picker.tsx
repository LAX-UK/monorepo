"use client";

import {
  resolveAdminUserForPickerAction,
  searchAdminUsersBrowseAction,
} from "@/lib/actions/admin-users-browse";
import { staffRoleLabel } from "@/lib/presenters/platform-role/platform-role-registry";
import { type EntityOption, EntityPicker } from "@auction/staff-ui";
import {
  type CapabilityRequirement,
  type UserRole,
  type UserStaffRole,
  userHasAccessTo,
} from "@auction/types";
import { useCallback, useEffect, useState } from "react";

type StaffRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  staffRole?: string | null;
};

function toOption(row: StaffRow): EntityOption {
  const roleLabel = row.staffRole ? staffRoleLabel(row.staffRole as UserStaffRole) : null;
  return {
    id: row.id,
    label: row.name || row.email,
    description: row.email,
    ...(roleLabel ? { meta: roleLabel } : {}),
  };
}

function canDo(row: StaffRow, access: CapabilityRequirement | undefined): boolean {
  if (!access) return true;
  return userHasAccessTo(
    row.role as UserRole,
    (row.staffRole ?? null) as UserStaffRole | null,
    access,
  );
}

/** The staff who can do the work, as picker options: name, then email, with their role. */
export function staffPickerOptions(
  rows: readonly StaffRow[],
  access?: CapabilityRequirement,
): EntityOption[] {
  return rows.filter((row) => canDo(row, access)).map(toOption);
}

type Props = {
  /** The chosen staff member's user ID, or null. */
  value: string | null;
  onValueChange: (option: EntityOption | null) => void;
  /** Only staff whose role allows this work are offered, e.g. taking telephone bids. */
  access?: CapabilityRequirement;
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
  id?: string;
};

/**
 * Choose a member of staff by name, with their email and role to tell people apart; never by
 * account ID. With `access`, people whose role cannot do the work are left out.
 */
export function StaffMemberPicker({
  value,
  onValueChange,
  access,
  placeholder = "Choose a member of staff",
  disabled,
  invalid,
  id,
}: Props) {
  const [selected, setSelected] = useState<EntityOption | null>(null);

  useEffect(() => {
    if (!value || selected?.id === value) return;
    let live = true;
    void resolveAdminUserForPickerAction(value).then((result) => {
      if (live && result.ok && result.data) setSelected(toOption(result.data));
    });
    return () => {
      live = false;
    };
  }, [value, selected?.id]);

  const search = useCallback(
    async (query: string) => {
      const result = await searchAdminUsersBrowseAction({
        ...(query ? { q: query } : {}),
        role: "staff",
        limit: 25,
        offset: 0,
      });
      if (!result.ok) throw new Error(result.error || "Search failed");
      return staffPickerOptions(result.data?.rows ?? [], access);
    },
    [access],
  );

  return (
    <EntityPicker
      value={value}
      selected={selected}
      onValueChange={(option) => {
        setSelected(option);
        onValueChange(option);
      }}
      search={search}
      placeholder={placeholder}
      searchPlaceholder="Search staff by name or email"
      emptyText="No staff match."
      {...(disabled !== undefined ? { disabled } : {})}
      {...(invalid !== undefined ? { invalid } : {})}
      {...(id ? { id } : {})}
    />
  );
}
