"use client";

import { type ReactNode, createContext, useContext } from "react";

type ArtistDetailContextValue = {
  /** Why the profile cannot be deleted, when the viewer may delete profiles. */
  deleteBlockers: readonly string[];
};

const ArtistDetailContext = createContext<ArtistDetailContextValue>({ deleteBlockers: [] });

/** What the artist page's layout knows that its overview also shows. */
export function ArtistDetailProvider({
  deleteBlockers,
  children,
}: ArtistDetailContextValue & { children: ReactNode }) {
  return (
    <ArtistDetailContext.Provider value={{ deleteBlockers }}>
      {children}
    </ArtistDetailContext.Provider>
  );
}

export function useArtistDetail(): ArtistDetailContextValue {
  return useContext(ArtistDetailContext);
}
