"use client";

import { FilterSelect } from "@/components/ui/filter-select";
import type { ArtistProfile, CategoryNode, Sale } from "@auction/types";
import { Button } from "@auction/ui/components/button";
import { Input } from "@auction/ui/components/input";
import { X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

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
  lens?: string | undefined;
  /** Options */
  artists: Pick<ArtistProfile, "id" | "displayName">[];
  sales: Pick<Sale, "id" | "title">[];
  categories: CategoryNode[];
};

const labelCapsCls =
  "font-label text-[10px] uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary";
const selectCls = "h-10 min-w-[9rem]";

function LotFilterSearch({ defaultQ }: { defaultQ?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  return (
    <form
      className="flex flex-col gap-1"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const nextQ = String(fd.get("q") ?? "").trim();
        const params = new URLSearchParams(searchParams.toString());
        params.set("offset", "0");
        if (nextQ) params.set("q", nextQ);
        else params.delete("q");
        const qs = params.toString();
        startTransition(() => {
          router.push(qs ? `${pathname}?${qs}` : pathname);
        });
      }}
    >
      <span className={labelCapsCls}>Search</span>
      <div className="flex items-center gap-2">
        <Input
          name="q"
          type="search"
          defaultValue={defaultQ ?? ""}
          placeholder="Title…"
          className="h-10 w-44 font-body text-sm"
        />
        <Button type="submit" className="h-10 shrink-0">
          Apply
        </Button>
      </div>
    </form>
  );
}

export function LotFilterForm({
  status,
  q,
  viewPipeline,
  artistId: _artistId,
  saleId: _saleId,
  categoryId: _categoryId,
  sort: _sort,
  lens: _lens,
  artists,
  sales,
  categories,
}: Props) {
  const flat = flattenCategories(categories);
  const hasFilters = !!(_artistId || _saleId || _categoryId || _sort || q);

  return (
    <div className="flex flex-wrap items-end gap-2">
      <LotFilterSearch defaultQ={q ?? ""} />

      {artists.length > 0 ? (
        <div className="flex flex-col gap-1">
          <span className={labelCapsCls}>Artist</span>
          <FilterSelect
            param="artistId"
            resetParams={{ offset: "0" }}
            className={selectCls}
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
          options={[{ value: "", label: "Default" }, ...SORT_OPTIONS]}
        />
      </div>

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
    </div>
  );
}
