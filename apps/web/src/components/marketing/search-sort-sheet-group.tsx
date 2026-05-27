"use client";

import { useSearchCatalogPending } from "@/components/marketing/search-catalog-client";
import { SORT_OPTIONS, type SearchSortValue } from "@/components/marketing/search-sort-select";
import { cn } from "@auction/ui";
import { Label } from "@auction/ui/components/label";
import { RadioGroup, RadioGroupItem } from "@auction/ui/components/radio-group";
import { usePathname, useSearchParams } from "next/navigation";

function buildHref(pathname: string, searchParams: URLSearchParams, sort: SearchSortValue): string {
  const next = new URLSearchParams(searchParams.toString());
  next.set("offset", "0");
  if (sort === "endingAsc") next.delete("sort");
  else next.set("sort", sort);
  const qs = next.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

type Props = {
  value: SearchSortValue;
  onSelect?: () => void;
};

/** Radio-style sort picker for the mobile filter sheet. */
export function SearchSortSheetGroup({ value, onSelect }: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { pending, navigate } = useSearchCatalogPending();

  return (
    <fieldset className="space-y-2" disabled={pending}>
      <legend className="mb-2 font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
        Sort by
      </legend>
      <RadioGroup
        value={value}
        onValueChange={(next) => {
          navigate(buildHref(pathname, searchParams, next as SearchSortValue));
          onSelect?.();
        }}
        className="space-y-2"
      >
        {SORT_OPTIONS.map((opt) => (
          <label
            key={opt.value}
            htmlFor={`search-sort-${opt.value}`}
            className={cn(
              "flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border px-4 py-2 font-body text-sm transition-colors",
              value === opt.value
                ? "border-primary bg-primary/10 text-on-surface"
                : "border-outline-variant/40 text-on-surface-variant hover:border-primary/30",
            )}
          >
            <RadioGroupItem value={opt.value} id={`search-sort-${opt.value}`} />
            <Label
              htmlFor={`search-sort-${opt.value}`}
              className="cursor-pointer font-body text-sm"
            >
              {opt.label}
            </Label>
          </label>
        ))}
      </RadioGroup>
    </fieldset>
  );
}
