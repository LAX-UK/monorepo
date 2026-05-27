"use client";

import {
  resolveAdminLegalEntityForPickerAction,
  searchAdminLegalEntitiesBrowseAction,
} from "@/lib/actions/admin-legal-entities-browse";
import type { AdminLegalEntityPickerRow } from "@/lib/data/http/admin.server";
import { AsyncCombobox } from "@auction/ui/components/async-combobox";

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

/** Admin-only: search legal entities by display name; optional empty query returns first page alphabetically. */
export function AdminLegalEntityPicker({
  value,
  displayLabel,
  onChange,
  disabled = false,
  searchPlaceholder = "Search by organisation or entity name…",
  id,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
  onBlur,
  searchHits = defaultSearchHits,
  resolveHit = defaultResolveHit,
}: AdminLegalEntityPickerProps) {
  return (
    <AsyncCombobox<AdminLegalEntityPickerRow>
      value={value}
      onChange={(id, hit) => onChange(id, hit)}
      disabled={disabled}
      minQueryLen={0}
      {...(id ? { id } : {})}
      {...(ariaInvalid !== undefined ? { "aria-invalid": ariaInvalid } : {})}
      {...(ariaDescribedBy ? { "aria-describedby": ariaDescribedBy } : {})}
      {...(onBlur ? { onBlur } : {})}
      placeholder={searchPlaceholder}
      searchPlaceholder={searchPlaceholder}
      searchHits={searchHits}
      resolveHit={resolveHit}
      renderHit={(row) => (
        <>
          <span className="font-medium text-on-surface">{row.displayName}</span>
          <span className="font-label text-[10px] uppercase tracking-wide text-on-surface-variant/80">
            {row.status.replaceAll("_", " ")}
          </span>
        </>
      )}
      renderSelected={(row) => (
        <>
          <p className="truncate font-medium text-on-surface">{row.displayName}</p>
          <p className="font-mono text-[11px] text-on-surface-variant">{row.id}</p>
        </>
      )}
      renderSelectedFallback={(id) => (
        <>
          <p className="truncate font-medium text-on-surface">{displayLabel ?? id}</p>
          <p className="font-mono text-[11px] text-on-surface-variant">{id}</p>
        </>
      )}
    />
  );
}
