"use client";

import { DashboardFilterSection } from "@/components/dashboard/filters/dashboard-filter-section";
import { FilterChip } from "@auction/ui";

type YearFilterSectionProps = {
  years: readonly number[];
  selectedYear: number | null;
  onSelectYear: (year: number | null) => void;
  label?: string;
};

/** Shared year chip row for filter sheets and toolbars. */
export function YearFilterSection({
  years,
  selectedYear,
  onSelectYear,
  label = "Year",
}: YearFilterSectionProps) {
  return (
    <DashboardFilterSection label={label}>
      <div className="flex flex-wrap gap-2">
        <FilterChip pressed={selectedYear == null} onClick={() => onSelectYear(null)}>
          All years
        </FilterChip>
        {years.map((year) => (
          <FilterChip key={year} pressed={selectedYear === year} onClick={() => onSelectYear(year)}>
            {year}
          </FilterChip>
        ))}
      </div>
    </DashboardFilterSection>
  );
}
