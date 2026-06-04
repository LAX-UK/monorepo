"use client";

import {
  type ArtistWatchlistClient,
  defaultArtistWatchlistClient,
} from "@/lib/data/http/artist-watchlist.client";
import { FOCUS_RING } from "@/lib/marketing/chrome";
import { cn } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import { Bookmark, BookmarkPlus, Eye } from "lucide-react";
import Link from "next/link";
import { useCallback, useState } from "react";

type Props = {
  artistId: string;
  initialWatching: boolean;
  isAuthenticated: boolean;
  loginNextPath: string;
  /** Injectable API transport (defaults to cookie-authenticated browser fetch). */
  client?: ArtistWatchlistClient;
};

export function ArtistWatchToggle({
  artistId,
  initialWatching,
  isAuthenticated,
  loginNextPath,
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
        href={`/login?next=${encodeURIComponent(loginNextPath)}`}
        className={cn(
          "inline-flex min-h-11 items-center gap-2 rounded-md bg-surface-container-high px-4 py-2 font-label text-xs font-bold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface transition-colors hover:bg-surface-container",
          FOCUS_RING,
        )}
      >
        <Eye className="size-4" aria-hidden />
        Sign in to follow
      </Link>
    );
  }

  return (
    <Button
      type="button"
      variant="secondary"
      disabled={busy}
      aria-pressed={watching}
      onClick={() => void toggle()}
      className={cn(
        "h-auto min-h-11 gap-2 rounded-md px-4 py-2 font-label text-xs font-bold uppercase tracking-[var(--text-label-caps-tracking,0.22em)]",
        FOCUS_RING,
        watching
          ? "bg-primary-container/30 text-primary hover:bg-primary-container/30"
          : "bg-surface-container-high text-on-surface hover:bg-surface-container",
      )}
    >
      {watching ? (
        <Bookmark className="size-4" aria-hidden />
      ) : (
        <BookmarkPlus className="size-4" aria-hidden />
      )}
      {watching ? "Following" : "Follow artist"}
    </Button>
  );
}
