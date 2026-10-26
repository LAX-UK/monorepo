"use client";

import {
  resolveAdminUserForPickerAction,
  searchAdminUsersBrowseAction,
} from "@/lib/actions/admin-users-browse";
import { staffRoleLabel } from "@/lib/presenters/platform-role/platform-role-registry";
import { type EntityOption, EntityPicker, humanizeStatus } from "@auction/staff-ui";
import type { UserStaffRole } from "@auction/types";
import { useCallback, useEffect, useState } from "react";

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  staffRole?: string | null;
};

/** The person's name, then their email to tell namesakes apart, with their role on the right. */
export function userPickerOption(row: UserRow): EntityOption {
  const role = row.staffRole
    ? staffRoleLabel(row.staffRole as UserStaffRole)
    : humanizeStatus(row.role);
  return {
    id: row.id,
    label: row.name.trim() || row.email,
    description: row.email,
    meta: role,
  };
}

type Props = {
  /** The chosen account's user ID, or null. */
  value: string | null;
  onValueChange: (option: EntityOption | null) => void;
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
  id?: string;
};

/**
 * Choose a platform account (client or staff) by name or email, never by account ID. Use
 * `StaffMemberPicker` when only staff can be chosen.
 */
export function PlatformUserPicker({
  value,
  onValueChange,
  placeholder = "Choose an account",
  disabled,
  invalid,
  id,
}: Props) {
  const [selected, setSelected] = useState<EntityOption | null>(null);

  useEffect(() => {
    if (!value || selected?.id === value) return;
    let live = true;
    void resolveAdminUserForPickerAction(value).then((result) => {
      if (live && result.ok && result.data) setSelected(userPickerOption(result.data));
    });
    return () => {
      live = false;
    };
  }, [value, selected?.id]);

  const search = useCallback(async (query: string) => {
    const result = await searchAdminUsersBrowseAction({
      ...(query ? { q: query } : {}),
      limit: 25,
      offset: 0,
    });
    if (!result.ok) throw new Error(result.error || "Search failed");
    return (result.data?.rows ?? []).map(userPickerOption);
  }, []);

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
      searchPlaceholder="Search by name or email"
      emptyText="No accounts match."
      {...(disabled !== undefined ? { disabled } : {})}
      {...(invalid !== undefined ? { invalid } : {})}
      {...(id ? { id } : {})}
    />
  );
}
