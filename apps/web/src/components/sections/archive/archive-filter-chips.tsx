"use client";

import { MarketingChipStrip } from "@/components/marketing/marketing-chip-strip";
import { FilterChip } from "@auction/ui";
import { useArchiveFilterNavigation } from "./use-archive-filter-navigation";

type Category = { id: string; name: string };

type Props = {
  categories: Category[];
  /** Years in which a sale with results closed; the year strip is hidden for fewer than two. */
  years: readonly number[];
};

/** Desktop quick filters for archive year and medium (toolbar strip, md+). */
export function ArchiveFilterChips({ categories, years }: Props) {
  const { pending, setParams, searchParams } = useArchiveFilterNavigation();

  const year = searchParams.get("year") ?? "all";
  const categoryId = searchParams.get("categoryId") ?? "";

  const showYears = years.length > 1;
  const showMedia = categories.length > 1;
  if (!showYears && !showMedia) return null;

  return (
    <div className="hidden min-w-0 md:flex md:flex-col md:gap-3">
      {showYears ? (
        <MarketingChipStrip aria-label="Lot year">
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
        </MarketingChipStrip>
      ) : null}
      {showMedia ? (
        <MarketingChipStrip aria-label="Medium">
          <FilterChip
            pressed={categoryId === ""}
            pending={pending}
            aria-current={categoryId === "" ? "true" : undefined}
            onClick={() => setParams({ categoryId: "" })}
          >
            All media
          </FilterChip>
          {categories.map((c) => (
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
        </MarketingChipStrip>
      ) : null}
    </div>
  );
}
