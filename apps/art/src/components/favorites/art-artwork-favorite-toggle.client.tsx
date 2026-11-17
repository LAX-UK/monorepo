"use client";

import { useFavoriteToggle } from "@/components/favorites/use-favorite-toggle.client";
import { useArtPageViewer } from "@/components/viewer/art-page-viewer.client";
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
  const pageViewer = useArtPageViewer();
  const effectiveAuth = pageViewer?.favoriteAuth ?? auth;
  const { active, pending, announcement, error, toggle } = useFavoriteToggle({
    initialActive: pageViewer ? pageViewer.savedArtworkSlugs.has(slug) : initialSaved,
    auth: effectiveAuth,
    mutate: (next) => {
      // A page that draws favourites in the browser has nothing for the server to redraw.
      const options = pageViewer ? { revalidate: false } : undefined;
      return next ? saveArtworkFavorite(slug, options) : removeArtworkFavorite(slug, options);
    },
    messages: { on: `${title} saved to favourites.`, off: `${title} removed from favourites.` },
  });

  return (
    <>
      <MarketingHeartToggle
        pressed={active}
        onPressedChange={toggle}
        busy={pending}
        label={effectiveAuth.signedIn ? `Save ${title} to favourites` : `Sign in to save ${title}`}
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
