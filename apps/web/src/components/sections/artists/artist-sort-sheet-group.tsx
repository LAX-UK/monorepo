"use client";

import { artistDirectoryWithQuery } from "@/lib/artists/directory-url";
import { cn } from "@auction/ui";
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
      <legend className="mb-2 font-label text-xs uppercase tracking-widest text-secondary">
        Sort by
      </legend>
      {ARTIST_SORT_OPTIONS.map((opt) => {
        const checked = value === opt.value;
        return (
          <label
            key={opt.value}
            className={cn(
              "flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border px-4 py-2 font-body text-sm transition-colors",
              checked
                ? "border-primary bg-primary/10 text-on-surface"
                : "border-outline-variant/40 text-on-surface-variant hover:border-primary/30",
            )}
          >
            <input
              type="radio"
              name="artist-sort"
              value={opt.value}
              checked={checked}
              className="size-4 accent-primary"
              onChange={() => {
                const href = artistDirectoryWithQuery(canonicalPath, sp, {
                  sort: opt.value === "name_asc" ? null : opt.value,
                  offset: null,
                });
                router.push(href);
                onSelect?.();
              }}
            />
            {opt.label}
          </label>
        );
      })}
    </fieldset>
  );
}
