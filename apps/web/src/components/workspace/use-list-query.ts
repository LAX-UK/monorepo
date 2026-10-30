"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

/** How long typing rests before the search applies and the address follows. */
const SEARCH_SETTLE_MS = 250;

/**
 * A list's search, filters and sort, held on the page and written to the address as they change,
 * so a view can be shared and the back button works. The address is updated in place: the list
 * is already on the page, so nothing is read again from the server. A new query from the server
 * (a tab link, the back button) replaces the local one.
 */
export function useListQuery<Q extends { q: string }>(
  initial: Q,
  toSearch: (query: Q) => string,
): {
  query: Q;
  setQuery: (next: Q) => void;
  /** The search box's text, ahead of the query while typing settles. */
  search: string;
  setSearch: (text: string) => void;
} {
  const pathname = usePathname();
  const [query, setQueryState] = useState(initial);
  const [search, setSearch] = useState(initial.q);
  const initialKey = toSearch(initial);
  const lastInitial = useRef(initialKey);

  useEffect(() => {
    if (lastInitial.current === initialKey) return;
    lastInitial.current = initialKey;
    setQueryState(initial);
    setSearch(initial.q);
  }, [initial, initialKey]);

  const setQuery = useCallback(
    (next: Q) => {
      setQueryState(next);
      setSearch(next.q);
      window.history.replaceState(window.history.state, "", `${pathname}${toSearch(next)}`);
    },
    [pathname, toSearch],
  );

  useEffect(() => {
    if (search.trim() === query.q) return;
    const timer = window.setTimeout(() => {
      const next = { ...query, q: search.trim() };
      setQueryState(next);
      window.history.replaceState(window.history.state, "", `${pathname}${toSearch(next)}`);
    }, SEARCH_SETTLE_MS);
    return () => window.clearTimeout(timer);
  }, [search, query, pathname, toSearch]);

  return { query, setQuery, search, setSearch };
}
