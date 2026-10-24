"use client";

import {
  searchArtworkOptions,
  searchEditionOptions,
  searchPartyOptions,
} from "@/server/application/admin-lookup-actions.server";
import type { LookupOption } from "@/server/domain/lookup-options.vm";
import { type EntityOption, EntityPicker } from "@auction/staff-ui";

/** The picker hands back what it listed; keep the parts a form needs to show the choice again. */
function toLookupOption(option: EntityOption): LookupOption {
  return {
    id: option.id,
    label: option.label,
    ...(option.description ? { description: option.description } : {}),
    ...(typeof option.meta === "string" ? { meta: option.meta } : {}),
  };
}

type RecordPickerProps = {
  /** The chosen record, kept by the form so its name shows after the search list changes. */
  value: LookupOption | null;
  onChange: (option: LookupOption | null) => void;
  invalid?: boolean;
  disabled?: boolean;
  id?: string;
  "aria-label"?: string;
};

function RecordPicker({
  value,
  onChange,
  search,
  placeholder,
  searchPlaceholder,
  emptyText,
  ...rest
}: RecordPickerProps & {
  search: (query: string) => Promise<LookupOption[]>;
  placeholder: string;
  searchPlaceholder: string;
  emptyText: string;
}) {
  return (
    <EntityPicker
      value={value?.id ?? null}
      onValueChange={(option) => onChange(option ? toLookupOption(option) : null)}
      search={search}
      selected={value}
      placeholder={placeholder}
      searchPlaceholder={searchPlaceholder}
      emptyText={emptyText}
      {...rest}
    />
  );
}

/** Choose a person (an owner, buyer, seller or client) by name or email. */
export function PartyPicker({
  search = searchPartyOptions,
  placeholder = "Search by name or email",
  ...props
}: RecordPickerProps & {
  search?: (query: string) => Promise<LookupOption[]>;
  placeholder?: string;
}) {
  return (
    <RecordPicker
      {...props}
      search={search}
      placeholder={placeholder}
      searchPlaceholder="Search by name or email"
      emptyText="No one matches."
    />
  );
}

/** Choose an artwork by title or artist. */
export function ArtworkPicker({
  search = searchArtworkOptions,
  placeholder = "Search by title or artist",
  ...props
}: RecordPickerProps & {
  search?: (query: string) => Promise<LookupOption[]>;
  placeholder?: string;
}) {
  return (
    <RecordPicker
      {...props}
      search={search}
      placeholder={placeholder}
      searchPlaceholder="Search by title or artist"
      emptyText="No artworks match."
    />
  );
}

/** Choose one edition of an artwork by title or artist. */
export function EditionPicker({
  search = searchEditionOptions,
  placeholder = "Search by artwork or artist",
  ...props
}: RecordPickerProps & {
  search?: (query: string) => Promise<LookupOption[]>;
  placeholder?: string;
}) {
  return (
    <RecordPicker
      {...props}
      search={search}
      placeholder={placeholder}
      searchPlaceholder="Search by artwork or artist"
      emptyText="No editions match."
    />
  );
}
