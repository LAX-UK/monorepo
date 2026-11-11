"use client";

import { EntityPicker } from "@auction/staff-ui";
import type { DealArtworkOption, DealArtworkSearchResult } from "@auction/validators";
import { useCallback, useEffect, useRef, useState } from "react";
import { toArtworkOption } from "./artwork-option";

/** Looks the register up for what was typed; rejects when the register cannot be read. */
export type SearchRegisterArtworks = (query: string) => Promise<DealArtworkSearchResult>;

const PRINT_STOCK_CODE = /-PRT-/i;
const PRINT_NOTE = "Only originals can be sold privately. Prints are sold in runs on LAX Shop.";

/** Nothing matched: say what was searched, or why a print's code finds nothing. */
function noMatch(query: string) {
  if (PRINT_STOCK_CODE.test(query)) {
    return (
      <>
        <strong className="block font-semibold text-staff-fg">{query} is a print</strong>
        {PRINT_NOTE}
      </>
    );
  }
  return (
    <>
      <strong className="block font-semibold text-staff-fg">
        {query ? `No original matches "${query}"` : "No originals to suggest"}
      </strong>
      Search by title, artist or stock code. If it's in Zoho, it appears here within a minute of
      being saved.
    </>
  );
}

type Props = {
  value: DealArtworkOption | null;
  onChange: (artwork: DealArtworkOption | null) => void;
  search: SearchRegisterArtworks;
  id?: string;
  invalid?: boolean;
  disabled?: boolean;
  /** Changes when the register should be asked again, e.g. after it refused an artwork. */
  refreshKey?: number;
  "aria-label"?: string;
};

/**
 * The staff-kit entity picker over the artwork register: type to search by title, artist or stock
 * code, see where each original is, and find those the register would not hold shown but locked.
 */
export function RegisterArtworkPicker({
  value,
  onChange,
  search,
  id,
  invalid,
  disabled,
  refreshKey = 0,
  ...aria
}: Props) {
  // What the last search returned, so a chosen option maps back to the full record.
  const known = useRef(new Map<string, DealArtworkOption>());
  const [hasMore, setHasMore] = useState(false);
  // The print message says the same as the footer, so a print's code shows it once.
  const [query, setQuery] = useState("");
  const footer = PRINT_STOCK_CODE.test(query)
    ? undefined
    : "Originals only. Prints are sold in runs on LAX Shop.";

  // biome-ignore lint/correctness/useExhaustiveDependencies: a new key asks the register again
  const find = useCallback(
    async (query: string) => {
      setQuery(query);
      const result = await search(query);
      known.current = new Map(result.items.map((item) => [item.id, item]));
      setHasMore(result.hasMore);
      return result.items.map((item) => toArtworkOption(item, { suggestions: query === "" }));
    },
    [search, refreshKey],
  );

  // A different page of the register may know the chosen artwork too.
  useEffect(() => {
    if (value) known.current.set(value.id, value);
  }, [value]);

  return (
    <EntityPicker
      value={value?.id ?? null}
      onValueChange={(option) => onChange(option ? (known.current.get(option.id) ?? null) : null)}
      search={find}
      {...(value ? { selected: toArtworkOption(value, { suggestions: false }, "size-8") } : {})}
      placeholder="Search by title, artist or stock code"
      searchPlaceholder="Search by title, artist or stock code"
      searchingText="Searching the register…"
      searchErrorText={
        <>
          <strong className="block font-semibold">Couldn't search the register</strong>
          Try again in a moment.
        </>
      }
      emptyText={noMatch}
      footer={
        hasMore ? "Originals only. There are more matches: type more to narrow them." : footer
      }
      {...(id ? { id } : {})}
      {...(invalid !== undefined ? { invalid } : {})}
      {...(disabled !== undefined ? { disabled } : {})}
      {...aria}
    />
  );
}
