"use client";

import { MarketingChipStrip } from "@/components/marketing/marketing-chip-strip";
import {
  type ArchiveSortMode,
  archiveSortLabel,
  buildArchiveYearRange,
} from "@/lib/archive/build-archive-params";
import { FilterChip } from "@auction/ui";
import { cn } from "@auction/ui";
import { Label } from "@auction/ui/components/label";
import { RadioGroup, RadioGroupItem } from "@auction/ui/components/radio-group";
import { useMemo } from "react";
import { useArchiveFilterNavigation } from "./use-archive-filter-navigation";

type Category = { id: string; name: string };

const SORT_OPTIONS: { value: ArchiveSortMode; label: string }[] = [
  { value: "hammer", label: archiveSortLabel("hammer") },
  { value: "recent", label: archiveSortLabel("recent") },
  { value: "artist", label: archiveSortLabel("artist") },
];

type Props = {
  categories: Category[];
  onSelect?: () => void;
  className?: string;
};

/** Archive filter controls for the mobile sheet (year, medium, sort). */
export function ArchiveFilterSheetBody({ categories, onSelect, className }: Props) {
  const { pending, setParams, searchParams } = useArchiveFilterNavigation();
  const years = useMemo(() => buildArchiveYearRange(), []);

  const year = searchParams.get("year") ?? "all";
  const categoryId = searchParams.get("categoryId") ?? "";
  const sort = (searchParams.get("sort") ?? "hammer") as ArchiveSortMode;

  const select = (updates: Record<string, string>) => {
    setParams(updates);
    onSelect?.();
  };

  return (
    <div className={cn("space-y-8", className)} aria-busy={pending || undefined}>
      <div className="space-y-3">
        <p className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
          Lot year
        </p>
        <MarketingChipStrip aria-label="Lot year">
          <FilterChip
            pressed={year === "all"}
            pending={pending}
            aria-current={year === "all" ? "true" : undefined}
            onClick={() => select({ year: "all" })}
          >
            All time
          </FilterChip>
          {years.map((y) => (
            <FilterChip
              key={y}
              pressed={year === String(y)}
              pending={pending}
              aria-current={year === String(y) ? "true" : undefined}
              onClick={() => select({ year: String(y) })}
            >
              {y}
            </FilterChip>
          ))}
        </MarketingChipStrip>
      </div>

      <div className="space-y-3">
        <p className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
          Medium
        </p>
        <MarketingChipStrip aria-label="Medium">
          <FilterChip
            pressed={categoryId === ""}
            pending={pending}
            aria-current={categoryId === "" ? "true" : undefined}
            onClick={() => select({ categoryId: "" })}
          >
            All media
          </FilterChip>
          {categories.map((c) => (
            <FilterChip
              key={c.id}
              pressed={categoryId === c.id}
              pending={pending}
              aria-current={categoryId === c.id ? "true" : undefined}
              onClick={() => select({ categoryId: c.id })}
            >
              {c.name}
            </FilterChip>
          ))}
        </MarketingChipStrip>
      </div>

      <fieldset className="space-y-2" disabled={pending}>
        <legend className="mb-2 font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
          Sort by
        </legend>
        <RadioGroup
          value={sort}
          onValueChange={(next) => select({ sort: next === "hammer" ? "" : next })}
          className="space-y-2"
        >
          {SORT_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              htmlFor={`archive-sort-${opt.value}`}
              className={cn(
                "flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border px-4 py-2 font-body text-sm transition-colors",
                sort === opt.value
                  ? "border-primary bg-primary/10 text-on-surface"
                  : "border-outline-variant/40 text-on-surface-variant hover:border-link/30",
              )}
            >
              <RadioGroupItem value={opt.value} id={`archive-sort-${opt.value}`} />
              <Label
                htmlFor={`archive-sort-${opt.value}`}
                className="cursor-pointer font-body text-sm"
              >
                {opt.label}
              </Label>
            </label>
          ))}
        </RadioGroup>
      </fieldset>
    </div>
  );
}
