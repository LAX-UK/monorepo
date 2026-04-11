"use client";

import type { Category } from "@auction/types";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useTransition } from "react";

const YEARS = [2024, 2023, 2022] as const;

type Props = {
  categories: Category[];
};

export function ArchiveFilterBar({ categories }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

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
    <section className="mx-auto mb-16 max-w-screen-2xl">
      <div className="flex flex-wrap items-center gap-x-12 gap-y-6 border-b border-outline-variant/20 pb-8">
        <div className="flex flex-col gap-2">
          <span className="font-label text-[0.625rem] uppercase tracking-[0.2em] text-on-surface-variant">
            Auction year
          </span>
          <div className="flex gap-4 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <button
              type="button"
              disabled={pending}
              onClick={() => setParams({ year: "all" })}
              className={
                year === "all"
                  ? "border-b border-primary pb-1 font-label text-[0.6875rem] uppercase tracking-[0.2em] text-primary"
                  : "font-label text-[0.6875rem] uppercase tracking-[0.2em] text-on-surface-variant transition-colors hover:text-on-surface"
              }
            >
              All time
            </button>
            {YEARS.map((y) => (
              <button
                key={y}
                type="button"
                disabled={pending}
                onClick={() => setParams({ year: String(y) })}
                className={
                  year === String(y)
                    ? "border-b border-primary pb-1 font-label text-[0.6875rem] uppercase tracking-[0.2em] text-primary"
                    : "font-label text-[0.6875rem] uppercase tracking-[0.2em] text-on-surface-variant transition-colors hover:text-on-surface"
                }
              >
                {y}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className="font-label text-[0.625rem] uppercase tracking-[0.2em] text-on-surface-variant">
            Medium
          </span>
          <div className="flex gap-4 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <button
              type="button"
              disabled={pending}
              onClick={() => setParams({ categoryId: "" })}
              className={
                categoryId === ""
                  ? "whitespace-nowrap border-b border-primary pb-1 font-label text-[0.6875rem] uppercase tracking-[0.2em] text-primary"
                  : "whitespace-nowrap font-label text-[0.6875rem] uppercase tracking-[0.2em] text-on-surface-variant transition-colors hover:text-on-surface"
              }
            >
              All media
            </button>
            {categoryOptions.map((c) => (
              <button
                key={c.id}
                type="button"
                disabled={pending}
                onClick={() => setParams({ categoryId: c.id })}
                className={
                  categoryId === c.id
                    ? "whitespace-nowrap border-b border-primary pb-1 font-label text-[0.6875rem] uppercase tracking-[0.2em] text-primary"
                    : "whitespace-nowrap font-label text-[0.6875rem] uppercase tracking-[0.2em] text-on-surface-variant transition-colors hover:text-on-surface"
                }
              >
                {c.name}
              </button>
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
            className="cursor-pointer border-none bg-transparent p-0 font-label text-[0.6875rem] font-medium uppercase tracking-[0.2em] text-on-surface focus:ring-0"
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
