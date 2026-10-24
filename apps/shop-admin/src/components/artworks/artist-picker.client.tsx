"use client";

import { searchArtistOptions } from "@/server/application/admin-artwork-actions.server";
import { type EntityOption, EntityPicker, cn } from "@auction/staff-ui";
import { useCallback } from "react";

/**
 * Choose an artist by name, searching the catalogue as staff type. Archived artists are not
 * offered: a new or edited artwork cannot be given to an artist who has left the storefront.
 */
export function ArtistPicker({
  value,
  selectedName,
  onChange,
  compact = false,
  placeholder = "Search artists…",
  invalid,
  disabled,
  ...aria
}: {
  value: string | null;
  /** The chosen artist's name, so it shows before any search has run. */
  selectedName: string | null;
  onChange: (artist: EntityOption | null) => void;
  /** Toolbar size, for filtering a list. */
  compact?: boolean;
  placeholder?: string;
  invalid?: boolean;
  disabled?: boolean;
  "aria-label"?: string;
}) {
  const search = useCallback((query: string) => searchArtistOptions(query), []);
  return (
    <EntityPicker
      value={value}
      onValueChange={onChange}
      search={search}
      selected={value && selectedName ? { id: value, label: selectedName } : null}
      placeholder={placeholder}
      searchPlaceholder="Search by name"
      emptyText="No artists match."
      {...(invalid !== undefined ? { invalid } : {})}
      {...(disabled !== undefined ? { disabled } : {})}
      {...(aria["aria-label"] ? { "aria-label": aria["aria-label"] } : {})}
      className={cn(compact && "h-control-sm w-44 text-staff-sm")}
    />
  );
}
