"use client";

import { searchAdminArtistsAction } from "@/lib/actions/admin-artists-search";
import { searchPublicArtists } from "@/lib/data/http/artist-search.client";
import type { ArtistKind, ArtistStatus } from "@auction/types";
import { Button } from "@auction/ui/components/button";
import { Input } from "@auction/ui/components/input";
import { Loader2, UserPlus } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export type ArtistSearchHit = {
  id: string;
  displayName: string;
  slug: string;
  kind: ArtistKind;
  status: ArtistStatus;
  matchedAlias: string | null;
  matchType: "exact" | "alias" | "partial" | "fuzzy";
  score: number;
};

type Props = {
  /** Initial search value (e.g. seeded from a lot title). */
  initialQuery?: string;
  /** Selected artist callback. */
  onSelect: (hit: ArtistSearchHit) => void;
  /** Called when the user clicks "Create new artist…". */
  onCreateNew?: (query: string) => void;
  /** Disable input + buttons. */
  disabled?: boolean;
  /** Placeholder text for the search input. */
  placeholder?: string;
  /** Admin pickers use the authenticated staff search (includes pending profiles). */
  mode?: "admin" | "public";
};

const DEBOUNCE_MS = 300;

export function ArtistSearch({
  initialQuery = "",
  onSelect,
  onCreateNew,
  disabled = false,
  placeholder = "Search artists by name or alias…",
  mode = "public",
}: Props) {
  const [query, setQuery] = useState(initialQuery);
  const [hits, setHits] = useState<ArtistSearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastRequestId = useRef(0);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setHits([]);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    const requestId = ++lastRequestId.current;
    const handle = setTimeout(async () => {
      try {
        if (mode === "admin") {
          const result = await searchAdminArtistsAction(trimmed);
          if (requestId !== lastRequestId.current) return;
          if (!result.ok) {
            setError(result.error || "Search failed.");
            setHits([]);
          } else {
            setHits(result.data ?? []);
          }
          return;
        }

        const result = await searchPublicArtists(trimmed);
        if (requestId !== lastRequestId.current) return;
        if (!result.ok) {
          setError("Search failed.");
          setHits([]);
        } else {
          setHits(result.data);
        }
      } catch {
        if (requestId === lastRequestId.current) {
          setError("Search failed.");
          setHits([]);
        }
      } finally {
        if (requestId === lastRequestId.current) setLoading(false);
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [mode, query]);

  return (
    <div className="space-y-2">
      <div className="relative">
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          aria-label="Artist search"
        />
        {loading && (
          <Loader2 className="absolute right-2 top-1/2 size-4 -translate-y-1/2 animate-spin text-on-surface-variant" />
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {hits.length > 0 && (
        <ul className="divide-y rounded-md border bg-surface" aria-label="Artist matches">
          {hits.map((hit) => (
            <li key={hit.id}>
              <Button
                type="button"
                variant="ghost"
                className="flex h-auto min-h-0 w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left font-body font-normal hover:bg-surface-container"
                onClick={() => onSelect(hit)}
                disabled={disabled || hit.status === "merged_into"}
              >
                <span className="flex flex-col">
                  <span className="font-medium">{hit.displayName}</span>
                  <span className="text-xs text-on-surface-variant">
                    {hit.matchType === "alias" && hit.matchedAlias
                      ? `Matched alias “${hit.matchedAlias}”`
                      : hit.matchType === "partial" && hit.matchedAlias
                        ? `Matched alias “${hit.matchedAlias}”`
                        : hit.matchType === "partial"
                          ? "Name contains your search"
                          : hit.matchType === "fuzzy"
                            ? `Fuzzy match (${(hit.score * 100).toFixed(0)}%)`
                            : "Exact match"}
                    {hit.status !== "approved" && ` · ${hit.status}`}
                  </span>
                </span>
                <span className="text-xs uppercase text-on-surface-variant">{hit.kind}</span>
              </Button>
            </li>
          ))}
        </ul>
      )}

      {onCreateNew && query.trim().length >= 2 && !loading && hits.length === 0 && (
        <div className="flex items-center justify-between rounded-md border bg-surface px-3 py-2">
          <span className="text-sm text-on-surface-variant">No matches for “{query.trim()}”.</span>
          <Button
            type="button"
            variant="secondaryOutline"
            onClick={() => onCreateNew(query.trim())}
            disabled={disabled}
          >
            <UserPlus className="mr-2 size-4" /> Create artist
          </Button>
        </div>
      )}
    </div>
  );
}
