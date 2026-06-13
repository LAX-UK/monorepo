"use client";

import { useOverlayTone, useOverlayToneContext } from "@/components/ui/overlay-tone-context";
import {
  type ArtistWatchlistClient,
  defaultArtistWatchlistClient,
} from "@/lib/data/http/artist-watchlist.client";
import { FOCUS_RING } from "@/lib/marketing/chrome";
import type { SlotName } from "@/lib/media/overlay-tone-types";
import {
  type OverlaySurface,
  overlayIconButtonClasses,
  overlayToneProps,
  resolveOverlayChrome,
} from "@/lib/ui/overlay-tone-classes";
import { cn } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import { Heart } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

const inlineShellClass = cn(
  "inline-flex size-[var(--tap-target-min,44px)] min-h-[var(--tap-target-min,44px)] min-w-[var(--tap-target-min,44px)] shrink-0 items-center justify-center rounded-full border border-outline-variant/40 bg-surface-container-high text-on-surface backdrop-blur-none transition-colors hover:bg-surface-container-highest motion-reduce:transition-none",
  FOCUS_RING,
);

type Props = {
  artistId: string;
  /** Display name, used for the screen-reader label. */
  artistName: string;
  initialWatching: boolean;
  isAuthenticated: boolean;
  /** Path to send unauthenticated users back to after they sign in. */
  loginNextPath: string;
  /** Visual shell: `onImage` = frosted glass; `inline` = solid toolbar; `auto` = derive from frame context. */
  surface?: OverlaySurface;
  /** Adaptive tone slot when using overlay chrome (default bottomRight on portraits). */
  overlaySlot?: SlotName;
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
  surface = "auto",
  overlaySlot = "bottomRight",
  client = defaultArtistWatchlistClient,
  onWatchingChange,
}: Props) {
  const router = useRouter();
  const [watching, setWatching] = useState(initialWatching);
  const [busy, setBusy] = useState(false);
  const inFrame = useOverlayToneContext() != null;
  const overlayTone = useOverlayTone(overlaySlot);
  const useOverlayChrome = resolveOverlayChrome(surface, "inline", inFrame);

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
        useOverlayChrome
          ? overlayIconButtonClasses(
              overlayTone,
              "size-[var(--tap-target-min,44px)] min-h-[var(--tap-target-min,44px)] min-w-[var(--tap-target-min,44px)] shrink-0 [&_svg]:size-4",
            )
          : inlineShellClass,
        useOverlayChrome ? FOCUS_RING : null,
        watching && "ring-1 ring-error/35 text-error hover:text-error",
        busy && "opacity-60",
      )}
      {...(useOverlayChrome ? overlayToneProps(overlayTone) : {})}
    >
      <Heart className={cn("size-4", watching && "fill-current")} aria-hidden strokeWidth={2} />
    </Button>
  );
}
