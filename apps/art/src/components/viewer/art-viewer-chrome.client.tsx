"use client";

import type { ArtViewerState } from "@/lib/art-viewer-state";
import {
  type ArtViewerChromeSnapshot,
  readArtViewerChrome,
} from "@/lib/viewer/art-viewer-snapshot";
import { type ReactNode, createContext, useContext, useEffect, useState } from "react";

const ArtViewerChromeContext = createContext<ArtViewerChromeSnapshot | null>(null);

/**
 * Holds the visitor's account chrome for the whole document. The root layout's HTML is shared
 * between visitors, so it starts as the guest it was drawn with and reads the visitor once per
 * document load, as the server-drawn layout did (a layout is not redrawn on in-app navigation).
 */
export function ArtViewerChromeProvider({
  guest,
  children,
}: {
  guest: ArtViewerState;
  children: ReactNode;
}) {
  const [snapshot, setSnapshot] = useState<ArtViewerChromeSnapshot>({
    account: guest,
    replyDot: false,
  });

  useEffect(() => {
    const controller = new AbortController();
    void readArtViewerChrome(controller.signal).then((next) => {
      if (next && !controller.signal.aborted) setSnapshot(next);
    });
    return () => controller.abort();
  }, []);

  return (
    <ArtViewerChromeContext.Provider value={snapshot}>{children}</ArtViewerChromeContext.Provider>
  );
}

export function useArtViewerChrome(): ArtViewerChromeSnapshot {
  const snapshot = useContext(ArtViewerChromeContext);
  if (!snapshot) throw new Error("useArtViewerChrome needs ArtViewerChromeProvider");
  return snapshot;
}
