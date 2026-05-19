import { ResetFiltersLink } from "@/components/admin/reset-filters-link";
import type { ReactNode } from "react";

type Props = {
  /** Filter chip row or other filter group(s) — rendered left-aligned. */
  filters?: ReactNode;
  /** Entity-specific pickers / dropdowns (e.g. ArtistPicker, sort select). */
  extra?: ReactNode;
  /** Export link, column picker, etc. */
  toolbarEnd?: ReactNode;
  /** When true, renders the Reset filters button. */
  hasFilters?: boolean;
  /** href for the "Reset filters" link (defaults to current path root). */
  resetHref?: string;
};

/**
 * Standard admin list toolbar: consistent layout composing filters, extra pickers,
 * and ResetFiltersLink. All props are optional — pass only what the specific list page needs.
 */
export function AdminListToolbar({
  filters,
  extra,
  toolbarEnd,
  hasFilters,
  resetHref = "",
}: Props) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex min-w-0 flex-1 flex-wrap items-start gap-3">
        {filters ? <div className="flex min-w-0 flex-wrap gap-2">{filters}</div> : null}
        {extra ? <div className="flex flex-wrap items-end gap-2">{extra}</div> : null}
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {toolbarEnd}
        <ResetFiltersLink active={!!hasFilters} href={resetHref} />
      </div>
    </div>
  );
}
