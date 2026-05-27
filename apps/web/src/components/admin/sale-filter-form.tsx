"use client";

import { FilterSelect, filterSelectTriggerClassName } from "@/components/ui/filter-select";
import type { SalePresetId } from "@/lib/admin/list-presets/sales-presets";
import { X } from "lucide-react";
import Link from "next/link";

type Props = {
  q?: string | undefined;
  lifecycle?: string | undefined;
  delivery?: string | undefined;
  activeLensId: SalePresetId;
};

const selectCls = filterSelectTriggerClassName;
const labelCapsCls =
  "font-label text-[10px] uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary";

export function SaleFilterForm({
  q: _q,
  lifecycle: _lifecycle,
  delivery: _delivery,
  activeLensId,
}: Props) {
  const hasFilters = Boolean(_delivery?.trim() || _lifecycle?.trim());

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <span className={labelCapsCls}>Time window</span>
        <FilterSelect
          param="lifecycle"
          resetParams={{ offset: "0" }}
          defaultValue={activeLensId === "all" ? "" : activeLensId}
          className={selectCls}
          options={[
            { value: "", label: "All sales" },
            { value: "upcoming", label: "Upcoming" },
            { value: "live", label: "Live now" },
            { value: "closed", label: "Past (not settled)" },
            { value: "settled", label: "Settled" },
          ]}
        />
      </div>

      <div className="flex flex-col gap-1">
        <span className={labelCapsCls}>Delivery mode</span>
        <FilterSelect
          param="delivery"
          resetParams={{ offset: "0" }}
          className={selectCls}
          options={[
            { value: "", label: "Any delivery" },
            { value: "online", label: "Online only" },
            { value: "onsite", label: "Onsite only" },
          ]}
        />
      </div>

      {hasFilters ? (
        <div className="pt-1">
          <Link
            href="/admin/sales"
            className="inline-flex min-h-10 items-center gap-1 rounded-md border border-outline-variant px-3 font-label text-xs uppercase tracking-[0.12em] text-on-surface-variant"
          >
            <X className="size-3.5" aria-hidden />
            Clear
          </Link>
        </div>
      ) : null}
    </div>
  );
}
