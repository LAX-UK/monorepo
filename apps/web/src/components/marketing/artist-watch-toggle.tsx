"use client";

import { MaterialIcon } from "@/components/ui/material-icon";
import {
  type ArtistWatchlistClient,
  defaultArtistWatchlistClient,
} from "@/lib/data/http/artist-watchlist.client";
import Link from "next/link";
import { useCallback, useState } from "react";

type Props = {
  artistId: string;
  initialWatching: boolean;
  isAuthenticated: boolean;
  /** Injectable API transport (defaults to cookie-authenticated browser fetch). */
  client?: ArtistWatchlistClient;
};

export function ArtistWatchToggle({
  artistId,
  initialWatching,
  isAuthenticated,
  client = defaultArtistWatchlistClient,
}: Props) {
  const [watching, setWatching] = useState(initialWatching);
  const [busy, setBusy] = useState(false);

  const toggle = useCallback(async () => {
    if (!isAuthenticated || busy) return;
    setBusy(true);
    try {
      if (watching) {
        const ok = await client.unfollow(artistId);
        if (ok) setWatching(false);
      } else {
        const ok = await client.follow(artistId);
        if (ok) setWatching(true);
      }
    } finally {
      setBusy(false);
    }
  }, [artistId, busy, isAuthenticated, watching, client]);

  if (!isAuthenticated) {
    return (
      <Link
        href={`/login?next=/artist/${encodeURIComponent(artistId)}`}
        className="inline-flex items-center gap-2 rounded-md bg-surface-container-high px-4 py-2 font-label text-xs font-bold uppercase tracking-widest text-on-surface transition-colors hover:bg-surface-container"
      >
        <MaterialIcon name="visibility" className="text-base" />
        Sign in to follow
      </Link>
    );
  }

  return (
    <button
      type="button"
      disabled={busy}
      aria-pressed={watching}
      onClick={() => void toggle()}
      className={`inline-flex items-center gap-2 rounded-md px-4 py-2 font-label text-xs font-bold uppercase tracking-widest transition-colors disabled:opacity-50 ${
        watching
          ? "bg-primary-container/30 text-primary"
          : "bg-surface-container-high text-on-surface hover:bg-surface-container"
      }`}
    >
      <MaterialIcon name={watching ? "bookmark" : "bookmark_add"} className="text-base" />
      {watching ? "Following" : "Follow artist"}
    </button>
  );
}
