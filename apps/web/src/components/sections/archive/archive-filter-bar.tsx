"use client";

import type { Category } from "@auction/types";
import { FilterChip } from "@auction/ui";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useTransition } from "react";

type Props = {
  categories: Category[];
};

function buildYearRange(): number[] {
  const current = new Date().getFullYear();
  const start = Math.max(current - 12, 2000);
  const years: number[] = [];
  for (let y = current; y >= start; y -= 1) years.push(y);
  return years;
}

export function ArchiveFilterBar({ categories }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const years = useMemo(() => buildYearRange(), []);

  const year = searchParams.get("year") ?? "all";
  const categoryId = searchParams.get("categoryId") ?? "";
  const sort = searchParams.get("sort") ?? "hammer";

  const setParams = useCallback(
    (updates: Record<string, string>) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(updates)) {
        if (v === "" || v === "all") next.delete(k);
        else next.set(k, v);
      }
      next.delete("page");
      startTransition(() => {
        router.push(`${pathname}?${next.toString()}`, { scroll: false });
      });
    },
    [pathname, router, searchParams],
  );

  const categoryOptions = useMemo(() => categories, [categories]);

  return (
    <section
      className="mx-auto mb-16 max-w-screen-2xl"
      aria-busy={pending || undefined}
      aria-live={pending ? "polite" : undefined}
    >
      <div className="flex flex-wrap items-center gap-x-12 gap-y-6 border-b border-outline-variant/20 pb-8">
        <div className="flex flex-col gap-2">
          <span className="font-label text-[0.625rem] uppercase tracking-[0.2em] text-on-surface-variant">
            Lot year
          </span>
          <div className="flex gap-3 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <FilterChip
              pressed={year === "all"}
              pending={pending}
              onClick={() => setParams({ year: "all" })}
            >
              All time
            </FilterChip>
            {years.map((y) => (
              <FilterChip
                key={y}
                pressed={year === String(y)}
                pending={pending}
                onClick={() => setParams({ year: String(y) })}
              >
                {y}
              </FilterChip>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className="font-label text-[0.625rem] uppercase tracking-[0.2em] text-on-surface-variant">
            Medium
          </span>
          <div className="flex gap-3 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <FilterChip
              pressed={categoryId === ""}
              pending={pending}
              onClick={() => setParams({ categoryId: "" })}
            >
              All media
            </FilterChip>
            {categoryOptions.map((c) => (
              <FilterChip
                key={c.id}
                pressed={categoryId === c.id}
                pending={pending}
                onClick={() => setParams({ categoryId: c.id })}
              >
                {c.name}
              </FilterChip>
            ))}
          </div>
        </div>

        <div className="ml-auto flex flex-col gap-2">
          <span className="font-label text-[0.625rem] uppercase tracking-[0.2em] text-on-surface-variant">
            Sort by
          </span>
          <select
            aria-label="Sort archive"
            disabled={pending}
            value={sort}
            onChange={(e) => setParams({ sort: e.target.value })}
            className="cursor-pointer border-none bg-transparent p-0 font-label text-xs font-medium uppercase tracking-[0.2em] text-on-surface focus-visible:rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <option value="hammer">Hammer price (high to low)</option>
            <option value="recent">Most recent</option>
            <option value="artist">Artist name (A to Z)</option>
          </select>
        </div>
      </div>
    </section>
  );
}
