"use client";

import type { SalePresetId } from "@/lib/admin/list-presets/sales-presets";
import { X } from "lucide-react";
import Link from "next/link";

type Props = {
  q?: string | undefined;
  lifecycle?: string | undefined;
  delivery?: string | undefined;
  activeLensId: SalePresetId;
};

const selectCls =
  "h-10 min-w-[9rem] rounded-md border border-outline-variant bg-surface-container-lowest px-2.5 font-body text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50";

export function SaleFilterForm({ q, lifecycle, delivery, activeLensId }: Props) {
  const hasFilters = Boolean(delivery?.trim() || lifecycle?.trim());

  return (
    <form method="get" action="/admin/sales" className="flex flex-col gap-4">
      <input type="hidden" name="offset" value="0" />
      {q?.trim() ? <input type="hidden" name="q" value={q} /> : null}

      <label className="flex flex-col gap-1">
        <span className="font-label text-[10px] uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
          Time window
        </span>
        <select
          name="lifecycle"
          defaultValue={lifecycle ?? (activeLensId === "all" ? "" : activeLensId)}
          className={selectCls}
        >
          <option value="">All sales</option>
          <option value="upcoming">Upcoming</option>
          <option value="live">Live now</option>
          <option value="closed">Past (not settled)</option>
          <option value="settled">Settled</option>
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="font-label text-[10px] uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
          Delivery mode
        </span>
        <select name="delivery" defaultValue={delivery ?? ""} className={selectCls}>
          <option value="">Any delivery</option>
          <option value="online">Online only</option>
          <option value="onsite">Onsite only</option>
        </select>
      </label>

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <button
          type="submit"
          className="inline-flex min-h-10 items-center rounded-md bg-primary px-4 font-label text-xs font-bold uppercase tracking-[0.12em] text-on-primary"
        >
          Apply filters
        </button>
        {hasFilters ? (
          <Link
            href="/admin/sales"
            className="inline-flex min-h-10 items-center gap-1 rounded-md border border-outline-variant px-3 font-label text-xs uppercase tracking-[0.12em] text-on-surface-variant"
          >
            <X className="size-3.5" aria-hidden />
            Clear
          </Link>
        ) : null}
      </div>
    </form>
  );
}
