"use client";

import { defaultArtistWatchlistClient } from "@/lib/data/http/artist-watchlist.client";
import { artistPath } from "@/lib/seo/url";
import { Button } from "@auction/ui/components/button";
import { Card, CardContent } from "@auction/ui/components/card";
import { X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type Props = {
  artistId: string;
  displayName: string;
};

/** Single followed-artist card with inline unfollow.
 *
 * Optimistically hides the card on success and refreshes server data so the
 * surrounding list re-renders without a follower count.
 */
export function ArtistFollowCard({ artistId, displayName }: Props) {
  const router = useRouter();
  const [hidden, setHidden] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const unfollow = () => {
    setError(null);
    startTransition(async () => {
      const ok = await defaultArtistWatchlistClient.unfollow(artistId);
      if (ok) {
        setHidden(true);
        router.refresh();
      } else {
        setError("Could not unfollow. Try again in a moment.");
      }
    });
  };

  if (hidden) return null;

  return (
    <Card className="border-outline-variant/15 shadow-sm transition-colors hover:border-primary/25 hover:shadow-md">
      <CardContent className="grid grid-cols-[1fr_auto] items-center gap-3 p-3 sm:p-4">
        <Link
          href={artistPath({ id: artistId, name: displayName })}
          title={displayName}
          className="min-w-0 truncate font-headline text-sm font-semibold text-on-surface underline-offset-4 hover:underline"
        >
          {displayName}
        </Link>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            type="button"
            onClick={unfollow}
            disabled={isPending}
            aria-label={`Unfollow ${displayName}`}
          >
            <X className="size-4" aria-hidden />
            <span className="ml-1 hidden sm:inline">Unfollow</span>
          </Button>
        </div>
        {error ? (
          <p className="col-span-2 text-xs text-error" role="alert">
            {error}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
