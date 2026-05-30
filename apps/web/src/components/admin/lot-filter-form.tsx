"use client";

import { FilterSelect } from "@/components/ui/filter-select";
import {
  LOT_LIST_SORT_KEYS,
  LOT_LIST_SORT_LABELS,
  type LotListSortKey,
} from "@/lib/admin/lots-list-sort";
import type { ArtistProfile, CategoryNode, Sale } from "@auction/types";
import { X } from "lucide-react";

const SORT_OPTIONS = LOT_LIST_SORT_KEYS.map((value) => ({
  value,
  label: LOT_LIST_SORT_LABELS[value],
}));

function flattenCategories(
  nodes: CategoryNode[],
  depth = 0,
): { id: string; name: string; depth: number }[] {
  return nodes.flatMap((n) => [
    { id: n.id, name: n.name, depth },
    ...flattenCategories(n.children, depth + 1),
  ]);
}

type Props = {
  /** Current filter values */
  artistId?: string | undefined;
  saleId?: string | undefined;
  categoryId?: string | undefined;
  sort?: LotListSortKey | undefined;
  /** Options */
  artists: Pick<ArtistProfile, "id" | "displayName">[];
  sales: Pick<Sale, "id" | "title">[];
  categories: CategoryNode[];
};

const labelCapsCls =
  "font-label text-[10px] uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary";
const selectCls = "h-10 min-w-[9rem]";

export function LotFilterForm({
  artistId: _artistId,
  saleId: _saleId,
  categoryId: _categoryId,
  sort,
  artists,
  sales,
  categories,
}: Props) {
  const flat = flattenCategories(categories);
  const hasFilters = Boolean(_artistId || _saleId || _categoryId || sort);

  return (
    <div className="flex flex-wrap items-end gap-2">
      {artists.length > 0 ? (
        <div className="flex flex-col gap-1">
          <span className={labelCapsCls}>Artist</span>
          <FilterSelect
            param="artistId"
            resetParams={{ offset: "0" }}
            className={selectCls}
            ariaLabel="Artist"
            options={[
              { value: "", label: "All artists" },
              ...artists.map((a) => ({ value: a.id, label: a.displayName })),
            ]}
          />
        </div>
      ) : null}

      {sales.length > 0 ? (
        <div className="flex flex-col gap-1">
          <span className={labelCapsCls}>Sale</span>
          <FilterSelect
            param="saleId"
            resetParams={{ offset: "0" }}
            className={selectCls}
            ariaLabel="Sale"
            options={[
              { value: "", label: "All sales" },
              ...sales.map((s) => ({ value: s.id, label: s.title })),
            ]}
          />
        </div>
      ) : null}

      {flat.length > 0 ? (
        <div className="flex flex-col gap-1">
          <span className={labelCapsCls}>Category</span>
          <FilterSelect
            param="categoryId"
            resetParams={{ offset: "0" }}
            className={selectCls}
            ariaLabel="Category"
            options={[
              { value: "", label: "All categories" },
              ...flat.map((c) => ({
                value: c.id,
                label: `${"  ".repeat(c.depth)}${c.name}`,
              })),
            ]}
          />
        </div>
      ) : null}

      <div className="flex flex-col gap-1">
        <span className={labelCapsCls}>Sort</span>
        <FilterSelect
          param="sort"
          resetParams={{ offset: "0" }}
          className={selectCls}
          defaultValue={sort ?? ""}
          ariaLabel="Sort"
          options={[{ value: "", label: "Default" }, ...SORT_OPTIONS]}
        />
      </div>

      {hasFilters ? (
        <a
          href="/admin/lots"
          className="flex h-10 items-center gap-1 rounded-md border border-outline-variant px-3 font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary transition-colors hover:bg-surface-container-high"
          aria-label="Clear search filters"
        >
          <X className="size-3" aria-hidden />
          Clear
        </a>
      ) : null}
    </div>
  );
}
