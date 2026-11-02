"use client";

import { buildHostedLoginStartHref } from "@/lib/auth/hosted-login-start-href";
import {
  type ArtistWatchlistClient,
  defaultArtistWatchlistClient,
} from "@/lib/data/http/artist-watchlist.client";
import { Button, ButtonLink } from "@auction/ui/lax";
import { Bookmark, BookmarkPlus } from "lucide-react";
import { useCallback, useState } from "react";

type Props = {
  artistId: string;
  initialWatching: boolean;
  isAuthenticated: boolean;
  loginNextPath: string;
  /** `primary` when following is the page's main action (the empty works state). */
  emphasis?: "primary" | "secondary";
  /** Injectable API transport (defaults to cookie-authenticated browser fetch). */
  client?: ArtistWatchlistClient;
};

export function ArtistWatchToggle({
  artistId,
  initialWatching,
  isAuthenticated,
  loginNextPath,
  emphasis = "secondary",
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
      <ButtonLink
        variant={emphasis}
        href={buildHostedLoginStartHref({ next: loginNextPath })}
        icon={<BookmarkPlus />}
      >
        Follow artist
      </ButtonLink>
    );
  }

  return (
    <Button
      type="button"
      variant={watching ? "secondary" : emphasis}
      disabled={busy}
      aria-pressed={watching}
      onClick={() => void toggle()}
      icon={watching ? <Bookmark /> : <BookmarkPlus />}
    >
      {watching ? "Following" : "Follow artist"}
    </Button>
  );
}
