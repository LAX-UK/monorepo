"use client";

import { useFavoriteToggle } from "@/components/favorites/use-favorite-toggle.client";
import {
  removeArtworkFavorite,
  saveArtworkFavorite,
} from "@/lib/favorites/art-favorites-actions.server";
import type { ArtFavoriteAuth } from "@/lib/favorites/favorite-auth";
import { MarketingHeartToggle, type MarketingHeartToggleProps } from "@auction/marketing-ui";
import { createPortal } from "react-dom";

export type ArtArtworkFavoriteToggleProps = {
  slug: string;
  title: string;
  initialSaved: boolean;
  auth: ArtFavoriteAuth;
  appearance?: MarketingHeartToggleProps["appearance"];
  size?: MarketingHeartToggleProps["size"];
  className?: string;
};

export function ArtArtworkFavoriteToggle({
  slug,
  title,
  initialSaved,
  auth,
  appearance,
  size,
  className,
}: ArtArtworkFavoriteToggleProps) {
  const { active, pending, announcement, error, toggle } = useFavoriteToggle({
    initialActive: initialSaved,
    auth,
    mutate: (next) => (next ? saveArtworkFavorite(slug) : removeArtworkFavorite(slug)),
    messages: { on: `${title} saved to favourites.`, off: `${title} removed from favourites.` },
  });

  return (
    <>
      <MarketingHeartToggle
        pressed={active}
        onPressedChange={toggle}
        busy={pending}
        label={auth.signedIn ? `Save ${title} to favourites` : `Sign in to save ${title}`}
        {...(appearance ? { appearance } : {})}
        {...(size ? { size } : {})}
        {...(className ? { className } : {})}
      />
      <output className="sr-only" aria-live="polite">
        {announcement}
      </output>
      {error
        ? createPortal(
            <p
              className="fixed inset-x-4 bottom-24 z-50 mx-auto max-w-sm rounded-md bg-on-surface px-4 py-3 text-center text-sm text-surface shadow-lg md:bottom-6"
              aria-hidden
            >
              {error}
            </p>,
            document.body,
          )
        : null}
    </>
  );
}
