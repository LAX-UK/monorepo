"use client";

import { FilterSelect } from "@/components/ui/filter-select";
import type { Category } from "@auction/types";
import { FilterChip } from "@auction/ui";
import { Separator } from "@auction/ui/components/separator";
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

function useArchiveFilterPendingNavigation() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const navigate = useCallback(
    (href: string) => {
      startTransition(() => {
        router.push(href, { scroll: false });
      });
    },
    [router],
  );
  return { pending, navigate };
}

export function ArchiveFilterBar({ categories }: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { pending, navigate } = useArchiveFilterPendingNavigation();
  const usePendingNavigation = useCallback(() => ({ pending, navigate }), [pending, navigate]);

  const years = useMemo(() => buildYearRange(), []);

  const year = searchParams.get("year") ?? "all";
  const categoryId = searchParams.get("categoryId") ?? "";

  const setParams = useCallback(
    (updates: Record<string, string>) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(updates)) {
        if (v === "" || v === "all") next.delete(k);
        else next.set(k, v);
      }
      next.delete("page");
      const qs = next.toString();
      navigate(qs ? `${pathname}?${qs}` : pathname);
    },
    [navigate, pathname, searchParams],
  );

  const categoryOptions = useMemo(() => categories, [categories]);

  return (
    <section
      className="mx-auto mb-16 max-w-screen-2xl"
      aria-busy={pending || undefined}
      aria-live={pending ? "polite" : undefined}
    >
      <div className="flex flex-wrap items-center gap-x-12 gap-y-6 border-b border-border-hairline pb-8">
        <div className="flex flex-col gap-2">
          <span className="font-label text-[0.625rem] uppercase tracking-[0.2em] text-on-surface-variant">
            Lot year
          </span>
          <div className="flex gap-3 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <FilterChip
              pressed={year === "all"}
              pending={pending}
              aria-current={year === "all" ? "true" : undefined}
              onClick={() => setParams({ year: "all" })}
            >
              All time
            </FilterChip>
            {years.map((y) => (
              <FilterChip
                key={y}
                pressed={year === String(y)}
                pending={pending}
                aria-current={year === String(y) ? "true" : undefined}
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
              aria-current={categoryId === "" ? "true" : undefined}
              onClick={() => setParams({ categoryId: "" })}
            >
              All media
            </FilterChip>
            {categoryOptions.map((c) => (
              <FilterChip
                key={c.id}
                pressed={categoryId === c.id}
                pending={pending}
                aria-current={categoryId === c.id ? "true" : undefined}
                onClick={() => setParams({ categoryId: c.id })}
              >
                {c.name}
              </FilterChip>
            ))}
          </div>
        </div>

        <Separator orientation="vertical" className="hidden h-12 md:block" />

        <div className="ml-auto flex flex-col gap-2">
          <span className="font-label text-[0.625rem] uppercase tracking-[0.2em] text-on-surface-variant">
            Sort by
          </span>
          <FilterSelect
            param="sort"
            defaultValue="hammer"
            clearParams={["page"]}
            usePendingNavigation={usePendingNavigation}
            options={[
              { value: "hammer", label: "Hammer price (high to low)" },
              { value: "recent", label: "Most recent" },
              { value: "artist", label: "Artist name (A to Z)" },
            ]}
            ariaLabel="Sort archive"
            className="h-auto cursor-pointer border-none bg-transparent p-0 font-label text-xs font-medium uppercase tracking-[0.2em] text-on-surface shadow-none focus:ring-0 focus-visible:rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          />
        </div>
      </div>
    </section>
  );
}
