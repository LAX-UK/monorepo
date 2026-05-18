"use client";

import type { ArtistProfile, CategoryNode, Sale } from "@auction/types";
import { X } from "lucide-react";

type LotSort = "createdDesc" | "endingAsc" | "hammerDesc" | "endedDesc" | "sellerAsc";

const SORT_OPTIONS: { value: LotSort; label: string }[] = [
  { value: "createdDesc", label: "Newest first" },
  { value: "endingAsc", label: "Ending soonest" },
  { value: "hammerDesc", label: "Highest hammer" },
  { value: "endedDesc", label: "Ended recently" },
  { value: "sellerAsc", label: "Seller A–Z" },
];

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
  status?: string | undefined;
  q?: string | undefined;
  viewPipeline?: boolean | undefined;
  /** Current filter values */
  artistId?: string | undefined;
  saleId?: string | undefined;
  categoryId?: string | undefined;
  sort?: LotSort | undefined;
  /** Options */
  artists: Pick<ArtistProfile, "id" | "displayName">[];
  sales: Pick<Sale, "id" | "title">[];
  categories: CategoryNode[];
};

const selectCls =
  "h-10 min-w-[9rem] rounded-md border border-outline-variant bg-surface-container-lowest px-2.5 font-body text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50";

export function LotFilterForm({
  status,
  q,
  viewPipeline,
  artistId,
  saleId,
  categoryId,
  sort,
  artists,
  sales,
  categories,
}: Props) {
  const flat = flattenCategories(categories);
  const hasFilters = !!(artistId || saleId || categoryId || sort || q);

  return (
    <form method="get" action="/admin/lots" className="flex flex-wrap items-end gap-2">
      {/* Preserve existing params */}
      {status ? <input type="hidden" name="status" value={status} /> : null}
      {viewPipeline ? <input type="hidden" name="view" value="pipeline" /> : null}

      {/* Search */}
      <label className="flex flex-col gap-1">
        <span className="font-label text-[10px] uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
          Search
        </span>
        <input
          name="q"
          type="search"
          defaultValue={q ?? ""}
          placeholder="Title…"
          className="h-10 w-44 rounded-md border border-outline-variant bg-surface-container-lowest px-2.5 font-body text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
      </label>

      {/* Artist */}
      {artists.length > 0 ? (
        <label className="flex flex-col gap-1">
          <span className="font-label text-[10px] uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
            Artist
          </span>
          <select name="artistId" defaultValue={artistId ?? ""} className={selectCls}>
            <option value="">All artists</option>
            {artists.map((a) => (
              <option key={a.id} value={a.id}>
                {a.displayName}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {/* Sale */}
      {sales.length > 0 ? (
        <label className="flex flex-col gap-1">
          <span className="font-label text-[10px] uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
            Sale
          </span>
          <select name="saleId" defaultValue={saleId ?? ""} className={selectCls}>
            <option value="">All sales</option>
            {sales.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {/* Category */}
      {flat.length > 0 ? (
        <label className="flex flex-col gap-1">
          <span className="font-label text-[10px] uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
            Category
          </span>
          <select name="categoryId" defaultValue={categoryId ?? ""} className={selectCls}>
            <option value="">All categories</option>
            {flat.map((c) => (
              <option key={c.id} value={c.id}>
                {"  ".repeat(c.depth)}
                {c.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {/* Sort */}
      <label className="flex flex-col gap-1">
        <span className="font-label text-[10px] uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
          Sort
        </span>
        <select name="sort" defaultValue={sort ?? ""} className={selectCls}>
          <option value="">Default</option>
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>

      <button
        type="submit"
        className="h-10 shrink-0 rounded-md bg-primary px-4 font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-primary transition-colors hover:bg-primary/90"
      >
        Apply
      </button>

      {hasFilters ? (
        <a
          href={`/admin/lots${status ? `?status=${status}` : ""}${viewPipeline ? `${status ? "&" : "?"}view=pipeline` : ""}`}
          className="flex h-10 items-center gap-1 rounded-md border border-outline-variant px-3 font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary transition-colors hover:bg-surface-container-high"
          aria-label="Clear search filters"
        >
          <X className="size-3" aria-hidden />
          Clear
        </a>
      ) : null}
    </form>
  );
}
