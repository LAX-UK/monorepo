"use client";

import { useFavoriteToggle } from "@/components/favorites/use-favorite-toggle.client";
import { useArtPageViewer } from "@/components/viewer/art-page-viewer.client";
import { followArtist, unfollowArtist } from "@/lib/favorites/art-favorites-actions.server";
import type { ArtFavoriteAuth } from "@/lib/favorites/favorite-auth";
import { cn } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import { useEffect } from "react";

export type ArtArtistFollowButtonProps = {
  slug: string;
  name: string;
  initialFollowing: boolean;
  auth: ArtFavoriteAuth;
  /** Followed-artist lists keep the outline treatment once following (Figma 867:15613). */
  followingVariant?: "default" | "secondaryOutline";
  /** Told whenever the following state changes, so a caption beside the button can follow it. */
  onActiveChange?: (active: boolean) => void;
  className?: string;
};

export function ArtArtistFollowButton({
  slug,
  name,
  initialFollowing,
  auth,
  followingVariant = "default",
  onActiveChange,
  className,
}: ArtArtistFollowButtonProps) {
  const pageViewer = useArtPageViewer();
  const { active, pending, announcement, error, toggle } = useFavoriteToggle({
    initialActive: pageViewer ? pageViewer.followedArtistSlugs.has(slug) : initialFollowing,
    auth: pageViewer?.favoriteAuth ?? auth,
    mutate: (next) => {
      // A page that draws favourites in the browser has nothing for the server to redraw.
      const options = pageViewer ? { revalidate: false } : undefined;
      return next ? followArtist(slug, options) : unfollowArtist(slug, options);
    },
    messages: { on: `Following ${name}.`, off: `Unfollowed ${name}.` },
  });

  useEffect(() => {
    onActiveChange?.(active);
  }, [active, onActiveChange]);

  return (
    <>
      <Button
        type="button"
        variant={active ? followingVariant : "secondaryOutline"}
        aria-pressed={active}
        aria-busy={pending || undefined}
        data-testid="art-artist-follow"
        className={cn("min-h-11 min-w-32 font-label", className)}
        onClick={() => {
          if (!pending) toggle(!active);
        }}
      >
        {active ? "Following" : "Follow"}
        <span className="sr-only"> {name}</span>
      </Button>
      <output className="sr-only" aria-live="polite">
        {announcement}
      </output>
      {error ? (
        <p className="mt-2 text-sm text-error" aria-hidden>
          {error}
        </p>
      ) : null}
    </>
  );
}
