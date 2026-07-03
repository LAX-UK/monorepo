"use client";

import { searchOnsiteEventGuests } from "@/lib/data/http/onsite-event-check-in.client";
import type { OnsiteEventCheckInSearchRow } from "@auction/types";
import { useEffect, useRef, useState } from "react";

export function useGuestSearch(slug: string) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<OnsiteEventCheckInSearchRow[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const searchGenerationRef = useRef(0);

  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) {
      setSearchResults([]);
      setSearchError(null);
      return;
    }
    const generation = ++searchGenerationRef.current;
    const handle = window.setTimeout(() => {
      setSearching(true);
      setSearchError(null);
      void searchOnsiteEventGuests(slug, searchQuery.trim())
        .then((rows) => {
          if (generation !== searchGenerationRef.current) return;
          setSearchResults(rows);
        })
        .catch((e) => {
          if (generation !== searchGenerationRef.current) return;
          setSearchResults([]);
          setSearchError(e instanceof Error ? e.message : "Search failed");
        })
        .finally(() => {
          if (generation === searchGenerationRef.current) setSearching(false);
        });
    }, 300);
    return () => window.clearTimeout(handle);
  }, [searchQuery, slug]);

  return {
    searchQuery,
    setSearchQuery,
    searchResults,
    searchError,
    searching,
  };
}
