"use client";

import { searchOriginalArtworkOptions } from "@/server/application/admin-artwork-actions.server";
import { type EntityOption, EntityPicker } from "@auction/staff-ui";
import { useCallback } from "react";

/**
 * Choose the original an edition was made from, searching lax.art originals by title or artist as
 * staff type. Choosing the selected original again clears the link.
 */
export function OriginalArtworkPicker({
  value,
  selectedTitle,
  onChange,
  invalid,
  disabled,
}: {
  value: string | null;
  /** The linked original's title, so it shows before any search has run. */
  selectedTitle: string | null;
  onChange: (original: EntityOption | null) => void;
  invalid?: boolean;
  disabled?: boolean;
}) {
  const search = useCallback((query: string) => searchOriginalArtworkOptions(query), []);
  return (
    <EntityPicker
      value={value}
      onValueChange={onChange}
      search={search}
      selected={value && selectedTitle ? { id: value, label: selectedTitle } : null}
      placeholder="No original linked"
      searchPlaceholder="Search originals by title or artist"
      emptyText="No originals on lax.art match."
      {...(invalid !== undefined ? { invalid } : {})}
      {...(disabled !== undefined ? { disabled } : {})}
    />
  );
}
