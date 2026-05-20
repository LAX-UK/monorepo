"use client";

import { AsyncCombobox } from "@/components/admin/_picker/async-combobox";

type AdminUserRow = {
  id: string;
  email: string;
  name: string;
  role: string;
};

function apiBase(): string {
  return process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "";
}

type Props = {
  value: string | null;
  onChange: (userId: string | null) => void;
  disabled?: boolean;
};

/** Admin-only: search platform users and link one as `ownerUserId` on an artist profile. */
export function UserPicker({ value, onChange, disabled = false }: Props) {
  return (
    <AsyncCombobox<AdminUserRow>
      value={value}
      onChange={onChange}
      disabled={disabled}
      placeholder="Search users by name or email…"
      searchHits={async (q) => {
        const qs = new URLSearchParams({ q, limit: "10", offset: "0" });
        const res = await fetch(`${apiBase()}/admin/users?${qs.toString()}`, {
          credentials: "include",
        });
        if (!res.ok) throw new Error("Search failed");
        const body = (await res.json()) as { data: { rows: AdminUserRow[] } };
        return body.data.rows;
      }}
      resolveHit={async (id) => {
        const res = await fetch(`${apiBase()}/admin/users/${encodeURIComponent(id)}`, {
          credentials: "include",
        });
        if (!res.ok) return null;
        const body = (await res.json()) as { data: AdminUserRow };
        return body.data;
      }}
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
