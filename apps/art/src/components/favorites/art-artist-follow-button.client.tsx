"use client";

import { useFavoriteToggle } from "@/components/favorites/use-favorite-toggle.client";
import { followArtist, unfollowArtist } from "@/lib/favorites/art-favorites-actions.server";
import type { ArtFavoriteAuth } from "@/lib/favorites/favorite-auth";
import { Button } from "@auction/ui/components/button";

export type ArtArtistFollowButtonProps = {
  slug: string;
  name: string;
  initialFollowing: boolean;
  auth: ArtFavoriteAuth;
};

export function ArtArtistFollowButton({
  slug,
  name,
  initialFollowing,
  auth,
}: ArtArtistFollowButtonProps) {
  const { active, pending, announcement, error, toggle } = useFavoriteToggle({
    initialActive: initialFollowing,
    auth,
    mutate: (next) => (next ? followArtist(slug) : unfollowArtist(slug)),
    messages: { on: `Following ${name}.`, off: `Unfollowed ${name}.` },
  });

  return (
    <>
      <Button
        type="button"
        variant={active ? "default" : "outline"}
        aria-pressed={active}
        aria-busy={pending || undefined}
        data-testid="art-artist-follow"
        className="min-h-11 min-w-32 font-label uppercase tracking-wide"
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
