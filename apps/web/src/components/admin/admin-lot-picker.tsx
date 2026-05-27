"use client";

import { searchAdminLotsBrowseAction } from "@/lib/actions/admin-lots-browse";
import type { AdminLotPickerRow } from "@/lib/data/http/admin.server";
import { AsyncCombobox } from "@auction/ui/components/async-combobox";
import { Button } from "@auction/ui/components/button";
import { useState } from "react";

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

export function AdminLotPicker({
  value,
  displayLabel,
  onChange,
  disabled = false,
  excludeSaleId,
  sellerLegalEntityId,
  searchPlaceholder = "Search draft lots by title…",
  id,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
  onBlur,
}: AdminLotPickerProps) {
  const [state, setState] = useState<"available" | "returned" | "all">("all");

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {(["available", "returned", "all"] as const).map((pill) => (
          <Button
            key={pill}
            type="button"
            size="sm"
            variant={state === pill ? "default" : "outline"}
            disabled={disabled}
            onClick={() => setState(pill)}
            className="rounded-full px-3 py-1 font-label text-[10px] uppercase tracking-wide"
          >
            {pill === "available" ? "New drafts" : pill === "returned" ? "Returned" : "All"}
          </Button>
        ))}
      </div>
      <AsyncCombobox<AdminLotPickerRow>
        key={state}
        value={value}
        onChange={(id, hit) => onChange(id, hit)}
        disabled={disabled}
        {...(id ? { id } : {})}
        {...(ariaInvalid !== undefined ? { "aria-invalid": ariaInvalid } : {})}
        {...(ariaDescribedBy ? { "aria-describedby": ariaDescribedBy } : {})}
        {...(onBlur ? { onBlur } : {})}
        minQueryLen={0}
        placeholder={searchPlaceholder}
        searchPlaceholder={searchPlaceholder}
        searchHits={async (q) => {
          const result = await searchAdminLotsBrowseAction({
            ...(q.trim() ? { q: q.trim() } : {}),
            state,
            ...(excludeSaleId ? { excludeSaleId } : {}),
            ...(sellerLegalEntityId ? { sellerLegalEntityId } : {}),
            limit: 25,
            offset: 0,
          });
          if (!result.ok) throw new Error(result.error || "Search failed");
          return result.data?.rows ?? [];
        }}
        resolveHit={async (id) => {
          const result = await searchAdminLotsBrowseAction({
            q: id,
            state,
            ...(excludeSaleId ? { excludeSaleId } : {}),
            ...(sellerLegalEntityId ? { sellerLegalEntityId } : {}),
            limit: 25,
            offset: 0,
          });
          if (!result.ok) return null;
          return result.data?.rows.find((row) => row.id === id) ?? null;
        }}
        renderHit={(row) => (
          <>
            <span className="font-medium text-on-surface">{row.title}</span>
            <span className="font-label text-[10px] uppercase tracking-wide text-on-surface-variant/80">
              {row.lifecycle.kind === "returned" ? "Returned to inventory" : "New draft"}
              {row.lifecycle.lastSaleName ? ` · ${row.lifecycle.lastSaleName}` : ""}
            </span>
          </>
        )}
        renderSelected={(row) => (
          <>
            <p className="truncate font-medium text-on-surface">{row.title}</p>
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
    </div>
  );
}
