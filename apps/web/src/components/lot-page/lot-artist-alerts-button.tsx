"use client";

import { buildHostedLoginStartHref } from "@/lib/auth/hosted-login-start-href";
import {
  type ArtistWatchlistClient,
  defaultArtistWatchlistClient,
} from "@/lib/data/http/artist-watchlist.client";
import { Button, ButtonLink } from "@auction/ui/lax";
import { Bell, BellRing } from "lucide-react";
import { useCallback, useState } from "react";

type Props = {
  artistId: string;
  artistName: string;
  signedIn: boolean;
  /** Where signing in returns to. */
  returnPath: string;
  client?: ArtistWatchlistClient;
};

/**
 * "Get alerts for the artist": the one thing to do with a lot that has ended. Following is saved
 * at once and the label says so; signed out, it takes the visitor to sign in and back here.
 */
export function LotArtistAlertsButton({
  artistId,
  artistName,
  signedIn,
  returnPath,
  client = defaultArtistWatchlistClient,
}: Props) {
  const [following, setFollowing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const toggle = useCallback(async () => {
    setBusy(true);
    setFailed(false);
    try {
      const ok = following ? await client.unfollow(artistId) : await client.follow(artistId);
      if (ok) setFollowing(!following);
      else setFailed(true);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }, [artistId, client, following]);

  if (!signedIn) {
    return (
      <ButtonLink
        href={buildHostedLoginStartHref({ next: returnPath })}
        size="lg"
        variant="secondary"
        icon={<Bell aria-hidden />}
        className="w-full"
      >
        Sign in to get alerts for {artistName}
      </ButtonLink>
    );
  }
  return (
    <div className="grid gap-2">
      <Button
        size="lg"
        variant="secondary"
        loading={busy}
        aria-pressed={following}
        icon={following ? <BellRing aria-hidden /> : <Bell aria-hidden />}
        onClick={() => void toggle()}
        className="w-full"
      >
        {following ? `You will hear about ${artistName}` : `Get alerts for ${artistName}`}
      </Button>
      <output className="text-lax-13 leading-5 text-lax-danger empty:hidden" aria-live="polite">
        {failed ? "We couldn't save that. Try again in a moment." : ""}
      </output>
    </div>
  );
}
