"use client";

import { MarketingChipStrip } from "@/components/marketing/marketing-chip-strip";
import { buildArchiveYearRange } from "@/lib/archive/build-archive-params";
import { FilterChip } from "@auction/ui";
import { useMemo } from "react";
import { useArchiveFilterNavigation } from "./use-archive-filter-navigation";

type Category = { id: string; name: string };

type Props = {
  categories: Category[];
};

/** Desktop quick filters for archive year and medium (toolbar strip, md+). */
export function ArchiveFilterChips({ categories }: Props) {
  const { pending, setParams, searchParams } = useArchiveFilterNavigation();
  const years = useMemo(() => buildArchiveYearRange(), []);

  const year = searchParams.get("year") ?? "all";
  const categoryId = searchParams.get("categoryId") ?? "";

  return (
    <div className="hidden min-w-0 md:flex md:flex-col md:gap-3">
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
    </div>
  );
}
