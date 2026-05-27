"use client";

import { artistDirectoryWithQuery } from "@/lib/artists/directory-url";
import { cn } from "@auction/ui";
import { Label } from "@auction/ui/components/label";
import { RadioGroup, RadioGroupItem } from "@auction/ui/components/radio-group";
import { useRouter, useSearchParams } from "next/navigation";

export const ARTIST_SORT_OPTIONS = [
  { value: "name_asc", label: "A–Z" },
  { value: "popular", label: "Most lots" },
  { value: "recent", label: "Recently added" },
] as const;

export type ArtistSortValue = (typeof ARTIST_SORT_OPTIONS)[number]["value"];

type Props = {
  canonicalPath: string;
  value: ArtistSortValue;
  onSelect?: () => void;
};

/** Radio-style sort picker for the mobile artist directory filter sheet. */
export function ArtistSortSheetGroup({ canonicalPath, value, onSelect }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sp = Object.fromEntries(searchParams.entries());

  return (
    <fieldset className="space-y-2">
      <legend className="mb-2 font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
        Sort by
      </legend>
      <RadioGroup
        value={value}
        onValueChange={(next) => {
          const href = artistDirectoryWithQuery(canonicalPath, sp, {
            sort: next === "name_asc" ? null : next,
            offset: null,
          });
          router.push(href);
          onSelect?.();
        }}
        className="space-y-2"
      >
        {ARTIST_SORT_OPTIONS.map((opt) => (
          <label
            key={opt.value}
            htmlFor={`artist-sort-${opt.value}`}
            className={cn(
              "flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border px-4 py-2 font-body text-sm transition-colors",
              value === opt.value
                ? "border-primary bg-primary/10 text-on-surface"
                : "border-outline-variant/40 text-on-surface-variant hover:border-primary/30",
            )}
          >
            <RadioGroupItem value={opt.value} id={`artist-sort-${opt.value}`} />
            <Label
              htmlFor={`artist-sort-${opt.value}`}
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
