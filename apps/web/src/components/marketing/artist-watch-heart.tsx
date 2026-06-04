"use client";

import {
  type ArtistWatchlistClient,
  defaultArtistWatchlistClient,
} from "@/lib/data/http/artist-watchlist.client";
import { FOCUS_RING } from "@/lib/marketing/chrome";
import { cn } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
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
  /** Called after a follow/unfollow attempt completes. */
  onWatchingChange?: (watching: boolean, ok: boolean) => void;
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
  onWatchingChange,
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
          if (ok) {
            setWatching(false);
            onWatchingChange?.(false, true);
          } else {
            onWatchingChange?.(true, false);
          }
        } else {
          const ok = await client.follow(artistId);
          if (ok) {
            setWatching(true);
            onWatchingChange?.(true, true);
          } else {
            onWatchingChange?.(false, false);
          }
        }
      } finally {
        setBusy(false);
      }
    },
    [artistId, busy, client, isAuthenticated, loginNextPath, onWatchingChange, router, watching],
  );

  const label = watching ? `Unfollow ${artistName}` : `Follow ${artistName}`;

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={(e) => void onClick(e)}
      disabled={busy}
      aria-pressed={watching}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex size-[var(--tap-target-min,44px)] min-h-[var(--tap-target-min,44px)] min-w-[var(--tap-target-min,44px)] shrink-0 rounded-full backdrop-blur-sm transition-colors [&_svg]:size-4",
        FOCUS_RING,
        watching
          ? "bg-surface/90 text-error ring-1 ring-error/35 hover:bg-surface hover:text-error"
          : "bg-surface/80 text-on-surface hover:bg-surface hover:text-on-surface",
        busy && "opacity-60",
      )}
    >
      <Heart className={cn("size-4", watching && "fill-current")} aria-hidden strokeWidth={2} />
    </Button>
  );
}
