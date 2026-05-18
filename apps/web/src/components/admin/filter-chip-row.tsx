"use client";

import { FilterRowNav } from "@/components/dashboard/filter-row-nav";

export type FilterChip = {
  id: string;
  label: string;
  href: string;
  active?: boolean;
};

export function FilterChipRow({ chips, label }: { chips: FilterChip[]; label: string }) {
  return (
    <FilterRowNav
      label={label}
      items={chips.map((chip) => ({
        id: chip.id,
        label: chip.label,
        href: chip.href,
        ...(chip.active !== undefined ? { active: chip.active } : {}),
      }))}
    />
  );
}
