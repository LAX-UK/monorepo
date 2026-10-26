"use client";

import {
  resolveAdminLotForPickerAction,
  searchAdminLotsBrowseAction,
} from "@/lib/actions/admin-lots-browse";
import type { AdminLotPickerRow } from "@/lib/data/http/admin.server";
import { type EntityOption, EntityPicker, SegmentedControl } from "@auction/staff-ui";
import { useCallback, useEffect, useState } from "react";

export type AdminLotPickerProps = {
  value: string | null;
  displayLabel: string | null;
  onChange: (id: string | null, row?: AdminLotPickerRow) => void;
  disabled?: boolean;
  excludeSaleId?: string;
  sellerLegalEntityId?: string;
  searchPlaceholder?: string;
  id?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
  onBlur?: () => void;
};

type LotState = "available" | "returned" | "all";

function toOption(row: AdminLotPickerRow): EntityOption {
  const kind = row.lifecycle.kind === "returned" ? "Returned to inventory" : "New draft";
  return {
    id: row.id,
    label: row.title,
    description: row.lifecycle.lastSaleName ? `${kind} · ${row.lifecycle.lastSaleName}` : kind,
  };
}

/** Choose a lot for a sale by its title, filtered to new drafts, returned lots or both. */
export function AdminLotPicker({
  value,
  displayLabel,
  onChange,
  disabled = false,
  excludeSaleId,
  sellerLegalEntityId,
  searchPlaceholder = "Search draft lots by title",
  id,
  "aria-invalid": ariaInvalid,
  onBlur,
}: AdminLotPickerProps) {
  const [state, setState] = useState<LotState>("all");
  const [rows, setRows] = useState<Record<string, AdminLotPickerRow>>({});
  const [selected, setSelected] = useState<EntityOption | null>(
    value && displayLabel?.trim() ? { id: value, label: displayLabel.trim() } : null,
  );

  useEffect(() => {
    if (!value) {
      setSelected(null);
      return;
    }
    if (selected?.id === value) return;
    let cancelled = false;
    void resolveAdminLotForPickerAction(value).then((result) => {
      if (cancelled || !result.ok || !result.data) return;
      const row = result.data;
      setRows((prev) => ({ ...prev, [row.id]: row }));
      setSelected(toOption(row));
    });
    return () => {
      cancelled = true;
    };
  }, [value, selected?.id]);

  const search = useCallback(
    async (q: string) => {
      const result = await searchAdminLotsBrowseAction({
        ...(q.trim() ? { q: q.trim() } : {}),
        state,
        ...(excludeSaleId ? { excludeSaleId } : {}),
        ...(sellerLegalEntityId ? { sellerLegalEntityId } : {}),
        limit: 25,
        offset: 0,
      });
      if (!result.ok) throw new Error(result.error || "Search failed");
      const hits = result.data?.rows ?? [];
      setRows((prev) => ({ ...prev, ...Object.fromEntries(hits.map((r) => [r.id, r])) }));
      return hits.map(toOption);
    },
    [excludeSaleId, sellerLegalEntityId, state],
  );

  return (
    <div className="flex flex-col gap-2">
      <SegmentedControl
        label="Which lots to list"
        value={state}
        onValueChange={setState}
        options={[
          { value: "available", label: "New drafts" },
          { value: "returned", label: "Returned" },
          { value: "all", label: "All" },
        ]}
      />
      <EntityPicker
        key={state}
        value={value}
        selected={selected}
        search={search}
        disabled={disabled}
        invalid={ariaInvalid === true}
        placeholder={searchPlaceholder}
        searchPlaceholder={searchPlaceholder}
        emptyText="No lots match."
        {...(id ? { id } : {})}
        onValueChange={(option) => {
          setSelected(option);
          onChange(option?.id ?? null, option ? rows[option.id] : undefined);
          onBlur?.();
        }}
      />
    </div>
  );
}
