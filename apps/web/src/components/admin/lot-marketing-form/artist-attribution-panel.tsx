"use client";

import { type ArtistChipModel, ArtistPicker } from "@/components/admin/artist-picker";
import { adminUpdateLotResultAction } from "@/lib/actions/admin";
import { notify } from "@/lib/ui/notify";
import type { ArtistProfile } from "@auction/types";
import { useState, useTransition } from "react";

/** Standalone admin control for the canonical-artist FK on a lot. Kept out of
 * the catalog-copy form because it auto-saves on change (single-purpose,
 * high-stakes assignment) and writes through the lot PATCH endpoint, not the
 * marketing-details JSON merge. */
export function ArtistAttributionPanel({
  lotId,
  artists,
  artistId,
  onSaved,
}: {
  lotId: string;
  artists: ArtistProfile[];
  artistId: string | null;
  onSaved: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [value, setValue] = useState<string | null>(artistId);

  function onChange(next: string | null) {
    setValue(next);
    startTransition(() => {
      void (async () => {
        const r = await adminUpdateLotResultAction(lotId, { artistId: next ?? null });
        if (r.ok) {
          notify.success(next ? "Artist attribution updated" : "Artist attribution cleared");
          onSaved();
          return;
        }
        notify.error(r.error);
        setValue(artistId);
      })();
    });
  }

  return (
    <section className="space-y-3 rounded-md border border-outline-variant/30 bg-surface-container-lowest/60 p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-label text-sm font-semibold text-on-surface">
          Canonical artist / maker
        </h3>
        {pending ? <span className="text-xs text-on-surface-variant">Saving…</span> : null}
      </div>
      <ArtistPicker
        value={value}
        onChange={onChange}
        selected={chipFromArtists(artists, value)}
        helpText="Drives the public artist page, structured data, and 'more by this maker' rails. Sellers cannot set this."
      />
    </section>
  );
}

function chipFromArtists(
  artists: ArtistProfile[],
  artistId: string | null,
): ArtistChipModel | null {
  if (!artistId) return null;
  const found = artists.find((a) => a.id === artistId);
  if (!found) return null;
  return {
    id: found.id,
    displayName: found.displayName,
    slug: found.slug,
    kind: found.kind ?? "artist",
    status: found.status ?? "approved",
  };
}
