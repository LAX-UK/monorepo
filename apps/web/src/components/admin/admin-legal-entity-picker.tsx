"use client";

import {
  resolveAdminLegalEntityForPickerAction,
  searchAdminLegalEntitiesBrowseAction,
} from "@/lib/actions/admin-legal-entities-browse";
import type { AdminLegalEntityPickerRow } from "@/lib/data/http/admin.server";
import { type EntityOption, EntityPicker } from "@auction/staff-ui";
import { useCallback, useEffect, useState } from "react";

export type AdminLegalEntityPickerProps = {
  value: string | null;
  /** Shown when `value` is set (from parent after selection). */
  displayLabel: string | null;
  onChange: (id: string | null, row?: AdminLegalEntityPickerRow) => void;
  disabled?: boolean;
  /** Placeholder for the search field when no entity is selected. */
  searchPlaceholder?: string;
  id?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
  onBlur?: () => void;
  /** Test overrides — default to server actions. */
  searchHits?: (query: string) => Promise<AdminLegalEntityPickerRow[]>;
  resolveHit?: (id: string) => Promise<AdminLegalEntityPickerRow | null>;
};

async function defaultSearchHits(q: string): Promise<AdminLegalEntityPickerRow[]> {
  const result = await searchAdminLegalEntitiesBrowseAction({
    ...(q.trim() ? { q: q.trim() } : {}),
    limit: 25,
    offset: 0,
  });
  if (!result.ok) throw new Error(result.error || "Search failed");
  return result.data?.rows ?? [];
}

async function defaultResolveHit(id: string): Promise<AdminLegalEntityPickerRow | null> {
  const result = await resolveAdminLegalEntityForPickerAction(id);
  if (!result.ok) return null;
  return result.data ?? null;
}

function statusText(status: string): string {
  const text = status.replaceAll("_", " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function toOption(row: AdminLegalEntityPickerRow): EntityOption {
  return { id: row.id, label: row.displayName, description: statusText(row.status) };
}

/** Admin-only: search organisations by name; an empty query lists the first page alphabetically. */
export function AdminLegalEntityPicker({
  value,
  displayLabel,
  onChange,
  disabled = false,
  searchPlaceholder = "Search by organisation name",
  id,
  "aria-invalid": ariaInvalid,
  "aria-describedby": _describedBy,
  onBlur,
  searchHits = defaultSearchHits,
  resolveHit = defaultResolveHit,
}: AdminLegalEntityPickerProps) {
  const [rows, setRows] = useState<Record<string, AdminLegalEntityPickerRow>>({});
  const [selected, setSelected] = useState<EntityOption | null>(
    value && displayLabel?.trim() ? { id: value, label: displayLabel.trim() } : null,
  );

  // A value arrives without a name (e.g. from a link): look the organisation up.
  useEffect(() => {
    if (!value) {
      setSelected(null);
      return;
    }
    if (selected?.id === value) return;
    let cancelled = false;
    void resolveHit(value).then((row) => {
      if (cancelled || !row) return;
      setRows((prev) => ({ ...prev, [row.id]: row }));
      setSelected(toOption(row));
    });
    return () => {
      cancelled = true;
    };
  }, [value, selected?.id, resolveHit]);

  const search = useCallback(
    async (query: string) => {
      const hits = await searchHits(query);
      setRows((prev) => ({ ...prev, ...Object.fromEntries(hits.map((r) => [r.id, r])) }));
      return hits.map(toOption);
    },
    [searchHits],
  );

  return (
    <EntityPicker
      value={value}
      selected={selected}
      search={search}
      disabled={disabled}
      invalid={ariaInvalid === true}
      placeholder={searchPlaceholder}
      searchPlaceholder={searchPlaceholder}
      emptyText="No organisations match."
      {...(id ? { id } : {})}
      onValueChange={(option) => {
        setSelected(option);
        onChange(option?.id ?? null, option ? rows[option.id] : undefined);
        onBlur?.();
      }}
    />
  );
}
