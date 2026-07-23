"use client";

import { type FilterChip, FilterChipRow } from "@/components/admin/filter-chip-row";
import { SegmentToggle } from "@auction/ui";
import { useRouter } from "next/navigation";

type Props = {
  chips: readonly FilterChip[];
  label?: string;
};

/** Figma table-card status segment — All / Live / Withdraw / Sold. */
export function LotsBoardStatusQuickFilter({ chips, label = "Filter lots by status" }: Props) {
  const router = useRouter();
  const active = chips.find((chip) => chip.active)?.id ?? "all";

  return (
    <SegmentToggle
      aria-label={label}
      value={active}
      onValueChange={(next) => {
        const chip = chips.find((c) => c.id === next);
        if (chip) router.push(chip.href);
      }}
      options={chips.map((chip) => ({
        value: chip.id,
        label: chip.label,
      }))}
    />
  );
}

/** Mobile-friendly chip row for the same quick status filter. */
export function LotsBoardStatusQuickFilterMobile({
  chips,
  label = "Filter lots by status",
}: Props) {
  return <FilterChipRow label={label} chips={[...chips]} />;
}
