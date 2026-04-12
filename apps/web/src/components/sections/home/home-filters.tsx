"use client";

import type { Category } from "@auction/types";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useTransition } from "react";

const SELLER = {
  "": "",
  alice: "seller-seed-001",
} as const;

const VALUATION = {
  "": { min: "", max: "" },
  low: { min: "10000", max: "50000" },
  mid: { min: "50000", max: "250000" },
} as const;

type Props = {
  categories: Category[];
};

export function HomeFilters({ categories }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const current = useMemo(() => {
    return {
      sellerId: searchParams.get("sellerId") ?? "",
      categoryId: searchParams.get("categoryId") ?? "",
      min: searchParams.get("min") ?? "",
      max: searchParams.get("max") ?? "",
    };
  }, [searchParams]);

  const setParams = useCallback(
    (updates: Record<string, string>) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(updates)) {
        if (v === "") next.delete(k);
        else next.set(k, v);
      }
      startTransition(() => {
        router.push(`${pathname}?${next.toString()}`, { scroll: false });
      });
    },
    [pathname, router, searchParams],
  );

  const sellerSelect = SELLER.alice === current.sellerId ? SELLER.alice : "";
  const categoryIds = new Set(categories.map((c) => c.id));
  const categorySelect = categoryIds.has(current.categoryId) ? current.categoryId : "";
  let valuationKey: keyof typeof VALUATION = "";
  if (current.min === VALUATION.low.min && current.max === VALUATION.low.max) valuationKey = "low";
  if (current.min === VALUATION.mid.min && current.max === VALUATION.mid.max) valuationKey = "mid";

  return (
    <section className="mb-20 px-4 md:px-10 lg:px-20">
      <div className="flex flex-col items-start justify-between border-b border-outline-variant/15 pb-12 lg:flex-row lg:items-center">
        <div className="grid w-full grid-cols-1 gap-8 sm:grid-cols-3 lg:w-auto lg:gap-16">
          <div className="group">
            <p className="mb-2 font-label text-xs font-bold uppercase tracking-[0.2em] text-secondary transition-colors group-hover:text-primary">
              Artist
            </p>
            <select
              aria-label="Filter by artist"
              disabled={pending}
              value={sellerSelect}
              onChange={(e) => {
                const v = e.target.value;
                setParams({ sellerId: v });
              }}
              className="w-full cursor-pointer appearance-none border-none bg-transparent p-0 pr-8 font-headline text-2xl text-on-surface hover:text-secondary focus:ring-0 disabled:opacity-50"
            >
              <option value="">All masters</option>
              <option value={SELLER.alice}>Alice Volkov</option>
            </select>
          </div>
          <div className="group">
            <p className="mb-2 font-label text-xs font-bold uppercase tracking-[0.2em] text-secondary transition-colors group-hover:text-primary">
              Medium
            </p>
            <select
              aria-label="Filter by category"
              disabled={pending}
              value={categorySelect}
              onChange={(e) => {
                setParams({ categoryId: e.target.value });
              }}
              className="w-full cursor-pointer appearance-none border-none bg-transparent p-0 pr-8 font-headline text-2xl text-on-surface hover:text-secondary focus:ring-0 disabled:opacity-50"
            >
              <option value="">Any medium</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="group">
            <p className="mb-2 font-label text-xs font-bold uppercase tracking-[0.2em] text-secondary transition-colors group-hover:text-primary">
              Valuation
            </p>
            <select
              aria-label="Filter by valuation band"
              disabled={pending}
              value={valuationKey}
              onChange={(e) => {
                const key = e.target.value as keyof typeof VALUATION;
                const band = VALUATION[key];
                if (!band) {
                  setParams({ min: "", max: "" });
                  return;
                }
                setParams({ min: band.min, max: band.max });
              }}
              className="w-full cursor-pointer appearance-none border-none bg-transparent p-0 pr-8 font-headline text-2xl text-on-surface hover:text-secondary focus:ring-0 disabled:opacity-50"
            >
              <option value="">Global scale</option>
              <option value="low">$10k — $50k</option>
              <option value="mid">$50k — $250k</option>
            </select>
          </div>
        </div>
        <div className="mt-12 flex flex-col items-end lg:mt-0">
          <span className="font-label text-xs font-bold uppercase tracking-[0.3em] text-secondary">
            Inventory status
          </span>
          <span className="mt-1 font-headline text-xl text-on-surface">
            {pending ? "Updating…" : "Curated lots from live data"}
          </span>
        </div>
      </div>
    </section>
  );
}
