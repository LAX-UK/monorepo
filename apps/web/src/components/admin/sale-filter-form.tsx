"use client";

import { FilterSelect, filterSelectTriggerClassName } from "@/components/ui/filter-select";
import type { SaleLensId } from "@/lib/admin/catalog/sales-lenses";
import {
  SALE_LIST_SORT_KEYS,
  SALE_LIST_SORT_LABELS,
  type SaleListSortKey,
} from "@/lib/admin/sales-list-sort";
import { X } from "lucide-react";
import Link from "next/link";

type Props = {
  lifecycle?: string | undefined;
  delivery?: string | undefined;
  sort?: SaleListSortKey | undefined;
  activeLensId: SaleLensId;
};

const selectCls = filterSelectTriggerClassName;
const labelCapsCls =
  "font-label text-[10px] uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary";

const LENS_LABELS: Record<Exclude<SaleLensId, "all" | "setup">, string> = {
  upcoming: "Upcoming",
  live: "Live now",
  closed: "Past (not settled)",
  settled: "Settled",
};

export function SaleFilterForm({
  lifecycle: _lifecycle,
  delivery: _delivery,
  sort,
  activeLensId,
}: Props) {
  const hasFilters = Boolean(_delivery?.trim() || _lifecycle?.trim() || sort);
  const lensLocked = activeLensId !== "all" && activeLensId !== "setup";

  return (
    <div className="flex flex-col gap-4">
      {lensLocked ? (
        <p className="rounded-md border border-outline-variant/60 bg-surface-container-low/50 px-3 py-2 font-body text-sm text-on-surface-variant">
          Filtered by lens:{" "}
          <span className="font-medium text-on-surface">
            {LENS_LABELS[activeLensId as keyof typeof LENS_LABELS] ?? activeLensId}
          </span>
          . Use the lens row above to change the time window.
        </p>
      ) : (
        <div className="flex flex-col gap-1">
          <span className={labelCapsCls}>Time window</span>
          <FilterSelect
            param="lifecycle"
            resetParams={{ offset: "0", lens: "" }}
            defaultValue=""
            className={selectCls}
            ariaLabel="Time window"
            options={[
              { value: "", label: "All sales" },
              { value: "upcoming", label: "Upcoming" },
              { value: "live", label: "Live now" },
              { value: "closed", label: "Past (not settled)" },
              { value: "settled", label: "Settled" },
            ]}
          />
        </div>
      )}

      <div className="flex flex-col gap-1">
        <span className={labelCapsCls}>Delivery mode</span>
        <FilterSelect
          param="delivery"
          resetParams={{ offset: "0" }}
          className={selectCls}
          ariaLabel="Delivery mode"
          options={[
            { value: "", label: "Any delivery" },
            { value: "online", label: "Online only" },
            { value: "onsite", label: "Onsite only" },
          ]}
        />
      </div>

      <div className="flex flex-col gap-1">
        <span className={labelCapsCls}>Sort</span>
        <FilterSelect
          param="sort"
          resetParams={{ offset: "0" }}
          defaultValue={sort ?? ""}
          className={selectCls}
          ariaLabel="Sort order"
          options={[
            { value: "", label: "Default" },
            ...SALE_LIST_SORT_KEYS.map((value) => ({
              value,
              label: SALE_LIST_SORT_LABELS[value],
            })),
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
