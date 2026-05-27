"use client";

import {
  resolveAdminUserForPickerAction,
  searchAdminUsersBrowseAction,
} from "@/lib/actions/admin-users-browse";
import { AsyncCombobox } from "@auction/ui/components/async-combobox";

export type AdminUserPickerRow = {
  id: string;
  email: string;
  name: string;
  role: string;
};

type Props = {
  value: string | null;
  onChange: (userId: string | null) => void;
  disabled?: boolean;
  id?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
  onBlur?: () => void;
  /** Test overrides — default to server actions. */
  searchHits?: (query: string) => Promise<AdminUserPickerRow[]>;
  resolveHit?: (id: string) => Promise<AdminUserPickerRow | null>;
};

function mapUserRow(row: {
  id: string;
  email: string;
  name: string;
  role: string;
}): AdminUserPickerRow {
  return { id: row.id, email: row.email, name: row.name, role: row.role };
}

async function defaultSearchHits(q: string): Promise<AdminUserPickerRow[]> {
  const result = await searchAdminUsersBrowseAction({
    ...(q.trim() ? { q: q.trim() } : {}),
    limit: 10,
    offset: 0,
  });
  if (!result.ok) throw new Error(result.error || "Search failed");
  return (result.data?.rows ?? []).map(mapUserRow);
}

async function defaultResolveHit(id: string): Promise<AdminUserPickerRow | null> {
  const result = await resolveAdminUserForPickerAction(id);
  if (!result.ok) return null;
  return result.data ? mapUserRow(result.data) : null;
}

/** Admin-only: search platform users and link one as `ownerUserId` on an artist profile. */
export function UserPicker({
  value,
  onChange,
  disabled = false,
  id,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
  onBlur,
  searchHits = defaultSearchHits,
  resolveHit = defaultResolveHit,
}: Props) {
  return (
    <AsyncCombobox<AdminUserPickerRow>
      value={value}
      onChange={onChange}
      disabled={disabled}
      {...(id ? { id } : {})}
      {...(ariaInvalid !== undefined ? { "aria-invalid": ariaInvalid } : {})}
      {...(ariaDescribedBy ? { "aria-describedby": ariaDescribedBy } : {})}
      {...(onBlur ? { onBlur } : {})}
      placeholder="Search users by name or email…"
      searchHits={searchHits}
      resolveHit={resolveHit}
      renderHit={(row) => (
        <>
          <span className="font-medium text-on-surface">{row.name}</span>
          <span className="text-xs text-on-surface-variant">{row.email}</span>
          <span className="font-label text-[10px] uppercase tracking-wide text-on-surface-variant/80">
            {row.role}
          </span>
        </>
      )}
      renderSelected={(row) => (
        <>
          <p className="truncate font-medium text-on-surface">
            {row.name} · {row.email}
          </p>
          <p className="font-label text-[11px] uppercase tracking-wide text-on-surface-variant">
            Role: {row.role}
          </p>
        </>
      )}
      renderSelectedFallback={(id) => (
        <p className="text-xs text-on-surface-variant">
          Linked user id (details unavailable): {id}
        </p>
      )}
    />
  );
}
