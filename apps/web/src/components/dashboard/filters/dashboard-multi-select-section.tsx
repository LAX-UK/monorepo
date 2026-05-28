"use client";

import { FilterChip } from "@auction/ui";
import type { ReactNode } from "react";
import { DashboardFilterSection } from "./dashboard-filter-section";

export type DashboardMultiSelectSectionProps = {
  label: string;
  options: readonly { id: string; label: string }[];
  selectedIds: readonly string[];
  onToggle: (id: string) => void;
  footer?: ReactNode;
};

/** Multi-select chip group for filter sheets. */
export function DashboardMultiSelectSection({
  label,
  options,
  selectedIds,
  onToggle,
}: DashboardMultiSelectSectionProps) {
  return (
    <DashboardFilterSection label={label}>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <FilterChip
            key={option.id}
            pressed={selectedIds.includes(option.id)}
            onClick={() => onToggle(option.id)}
          >
            {option.label}
          </FilterChip>
        ))}
      </div>
    </DashboardFilterSection>
  );
}
