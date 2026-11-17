"use client";

import { useArtViewerChrome } from "@/components/viewer/art-viewer-chrome.client";
import type { ArtViewerState } from "@/lib/art-viewer-state";
import type { ArtFavoriteAuth } from "@/lib/favorites/favorite-auth";
import {
  type ArtViewerFavouritesSnapshot,
  readArtViewerFavourites,
} from "@/lib/viewer/art-viewer-snapshot";
import { type ReactNode, createContext, useContext, useEffect, useMemo, useState } from "react";

/** The visitor as a prerendered page's controls see it once the browser has read it. */
export type ArtPageViewer = {
  viewer: ArtViewerState;
  favoriteAuth: ArtFavoriteAuth;
  savedArtworkSlugs: ReadonlySet<string>;
  followedArtistSlugs: ReadonlySet<string>;
};

const ArtPageViewerContext = createContext<ArtPageViewer | null>(null);

/**
 * Wraps a page whose HTML is shared between visitors (rendered as a guest). Hearts, Follow buttons
 * and the enquiry form inside it take the visitor from here instead of their server props, so a
 * signed-in visitor sees their own favourites and details once they are read.
 */
export function ArtPageViewerProvider({
  loginHref,
  children,
}: {
  /** Where a signed-out visitor goes to sign in, returning to this page (built on the server). */
  loginHref: string;
  children: ReactNode;
}) {
  const { account } = useArtViewerChrome();
  const signedIn = account.kind === "authenticated";
  const [favourites, setFavourites] = useState<ArtViewerFavouritesSnapshot | null>(null);

  useEffect(() => {
    if (!signedIn) {
      setFavourites(null);
      return;
    }
    const controller = new AbortController();
    void readArtViewerFavourites(controller.signal).then((next) => {
      if (next && !controller.signal.aborted) setFavourites(next);
    });
    return () => controller.abort();
  }, [signedIn]);

  const value = useMemo<ArtPageViewer>(
    () => ({
      viewer: account,
      favoriteAuth: { signedIn, loginHref },
      savedArtworkSlugs: new Set(favourites?.savedArtworkSlugs),
      followedArtistSlugs: new Set(favourites?.followedArtistSlugs),
    }),
    [account, signedIn, loginHref, favourites],
  );

  return <ArtPageViewerContext.Provider value={value}>{children}</ArtPageViewerContext.Provider>;
}

/** Null outside a prerendered page: the control's server props describe the visitor. */
export function useArtPageViewer(): ArtPageViewer | null {
  return useContext(ArtPageViewerContext);
}
