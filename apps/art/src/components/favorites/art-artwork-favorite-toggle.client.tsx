"use client";

import { useFavoriteToggle } from "@/components/favorites/use-favorite-toggle.client";
import {
  removeArtworkFavorite,
  saveArtworkFavorite,
} from "@/lib/favorites/art-favorites-actions.server";
import type { ArtFavoriteAuth } from "@/lib/favorites/favorite-auth";
import { MarketingHeartToggle } from "@auction/marketing-ui";

export type ArtArtworkFavoriteToggleProps = {
  slug: string;
  title: string;
  initialSaved: boolean;
  auth: ArtFavoriteAuth;
  className?: string;
};

export function ArtArtworkFavoriteToggle({
  slug,
  title,
  initialSaved,
  auth,
  className,
}: ArtArtworkFavoriteToggleProps) {
  const { active, pending, announcement, toggle } = useFavoriteToggle({
    initialActive: initialSaved,
    auth,
    mutate: (next) => (next ? saveArtworkFavorite(slug) : removeArtworkFavorite(slug)),
    messages: { on: `${title} saved to favorites.`, off: `${title} removed from favorites.` },
  });

  return (
    <>
      <MarketingHeartToggle
        pressed={active}
        onPressedChange={toggle}
        busy={pending}
        label={auth.signedIn ? `Save ${title} to favorites` : `Sign in to save ${title}`}
        {...(className ? { className } : {})}
      />
      <output className="sr-only" aria-live="polite">
        {announcement}
      </output>
    </>
  );
}
