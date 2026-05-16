"use client";

import {
  type ArtistWatchlistClient,
  defaultArtistWatchlistClient,
} from "@/lib/data/http/artist-watchlist.client";
import { cn } from "@auction/ui";
import { Heart } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

type Props = {
  artistId: string;
  /** Display name, used for the screen-reader label. */
  artistName: string;
  initialWatching: boolean;
  isAuthenticated: boolean;
  /** Path to send unauthenticated users back to after they sign in. */
  loginNextPath: string;
  /** Injectable API transport (defaults to cookie-authenticated browser fetch). */
  client?: ArtistWatchlistClient;
};

/** Compact heart-style follow toggle for directory cards. Stops link
 * propagation so clicking the heart never navigates the parent card link. */
export function ArtistWatchHeart({
  artistId,
  artistName,
  initialWatching,
  isAuthenticated,
  loginNextPath,
  client = defaultArtistWatchlistClient,
}: Props) {
  const router = useRouter();
  const [watching, setWatching] = useState(initialWatching);
  const [busy, setBusy] = useState(false);

  const onClick = useCallback(
    async (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();
      if (!isAuthenticated) {
        router.push(`/login?next=${encodeURIComponent(loginNextPath)}`);
        return;
      }
      if (busy) return;
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
    },
    [artistId, busy, client, isAuthenticated, loginNextPath, router, watching],
  );

  const label = watching ? `Unfollow ${artistName}` : `Follow ${artistName}`;

  return (
    <button
      type="button"
      onClick={(e) => void onClick(e)}
      disabled={busy}
      aria-pressed={watching}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex size-9 items-center justify-center rounded-full backdrop-blur-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
        watching
          ? "bg-surface/90 text-error ring-1 ring-error/35 hover:bg-surface"
          : "bg-surface/80 text-on-surface hover:bg-surface",
        busy && "opacity-60",
      )}
    >
      <Heart className={cn("size-4", watching && "fill-current")} aria-hidden strokeWidth={2} />
    </button>
  );
}
