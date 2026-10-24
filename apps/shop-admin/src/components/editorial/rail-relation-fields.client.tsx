"use client";

import { RelationListEditor } from "@/components/editorial/relation-list-editor.client";
import { TextField } from "@/components/forms/fields";
import { adminMutationErrorMessage } from "@/lib/admin-mutation-message";
import {
  resolveRailSlugs,
  searchEditorialLinkCandidates,
} from "@/server/application/admin-editorial-links-actions.server";
import {
  RAIL_MAX_ITEMS,
  type RailKind,
  type RailRow,
  matchRailSlugs,
  railRowFromItem,
  railRowsFor,
  railSlugs,
} from "@/server/domain/editorial-rails.vm";
import { useCallback, useEffect, useRef, useState } from "react";

const NOUNS = {
  artwork: { plural: "artworks", singular: "artwork" },
  artist: { plural: "artists", singular: "artist" },
} as const;

/**
 * An artwork or artist rail: a headline and the records it shows, chosen by name and put in
 * order. The block still stores the records' public addresses (slugs); the names are looked up
 * for editing and the slugs written back as the list changes.
 */
export function RailRelationFields({
  kind,
  headline,
  slugs,
  disabled,
  onChange,
}: {
  kind: RailKind;
  headline: string;
  slugs: readonly string[];
  disabled: boolean;
  onChange: (next: { headline: string; slugs: string[] }) => void;
}) {
  const noun = NOUNS[kind];
  const [known, setKnown] = useState<ReadonlyMap<string, RailRow>>(new Map());
  const requested = useRef(new Set<string>());

  // Look up names for slugs not named yet: the ones the block opened with.
  useEffect(() => {
    const unknown = slugs.filter((slug) => !known.has(slug) && !requested.current.has(slug));
    if (unknown.length === 0) return;
    for (const slug of unknown) requested.current.add(slug);
    let cancelled = false;
    resolveRailSlugs({ kind, slugs: unknown })
      .then((result) => {
        if (cancelled) return;
        if (!result.ok) {
          for (const slug of unknown) requested.current.delete(slug);
          return;
        }
        const bySlug = new Map(unknown.map((slug) => [slug, result.data] as const));
        setKnown((previous) => new Map([...previous, ...matchRailSlugs(unknown, bySlug)]));
      })
      .catch(() => {
        for (const slug of unknown) requested.current.delete(slug);
      });
    return () => {
      cancelled = true;
    };
  }, [slugs, known, kind]);

  const search = useCallback(
    async (query: string): Promise<RailRow[]> => {
      const result = await searchEditorialLinkCandidates({ kind, query, cursor: null });
      if (!result.ok) throw new Error(adminMutationErrorMessage(result));
      return result.data.items.map(railRowFromItem);
    },
    [kind],
  );

  return (
    <div className="space-y-3">
      <TextField
        label="Rail headline (optional)"
        value={headline}
        maxLength={200}
        disabled={disabled}
        onChange={(value) => onChange({ headline: value, slugs: [...slugs] })}
      />
      <RelationListEditor
        label={`${noun.plural} in this rail`}
        plural={noun.plural}
        items={railRowsFor(slugs, known)}
        onChange={(next) => {
          // Remember the names of records just added; the rest are already known or loading.
          const added = next.filter((row) => !slugs.includes(row.id));
          if (added.length > 0) {
            setKnown(
              (previous) => new Map([...previous, ...added.map((row) => [row.id, row] as const)]),
            );
          }
          onChange({ headline, slugs: railSlugs(next) });
        }}
        search={search}
        ordered
        disabled={disabled}
        emptyText={`No ${noun.plural} in this rail yet.`}
        addLabel={`Add ${noun.singular}`}
        max={RAIL_MAX_ITEMS}
      />
    </div>
  );
}
