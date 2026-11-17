"use client";

import type { ArtViewerState } from "@/lib/art-viewer-state";
import {
  type ArtViewerChromeSnapshot,
  readArtViewerChrome,
} from "@/lib/viewer/art-viewer-snapshot";
import { type ReactNode, createContext, useContext, useEffect, useRef, useState } from "react";

/** The account chrome, and whether the browser has read the visitor yet. */
export type ArtViewerChrome = ArtViewerChromeSnapshot & {
  /**
   * False until `/api/viewer` has answered (or failed). Until then `account` is only the guest
   * the shared HTML was drawn with, so the account controls keep their place but stay hidden:
   * a signed-in visitor never sees the guest control first, and nothing moves when theirs lands.
   */
  settled: boolean;
};

const ArtViewerChromeContext = createContext<ArtViewerChrome | null>(null);

/**
 * Holds the visitor's account chrome for the whole document. The root layout's HTML is shared
 * between visitors, so it starts unsettled, with the guest it was drawn with, and reads the
 * visitor once per document load, as the server-drawn layout did (a layout is not redrawn on
 * in-app navigation). A failed read settles as that guest.
 */
export function ArtViewerChromeProvider({
  guest,
  children,
}: {
  guest: ArtViewerState;
  children: ReactNode;
}) {
  const [snapshot, setSnapshot] = useState<ArtViewerChrome>({
    account: guest,
    replyDot: false,
    settled: false,
  });

  // Read once per document, as before; a re-render of the layout does not read again.
  const guestRef = useRef(guest);

  useEffect(() => {
    const controller = new AbortController();
    void readArtViewerChrome(controller.signal).then((next) => {
      if (controller.signal.aborted) return;
      setSnapshot(
        next
          ? { ...next, settled: true }
          : { account: guestRef.current, replyDot: false, settled: true },
      );
    });
    return () => controller.abort();
  }, []);

  return (
    <ArtViewerChromeContext.Provider value={snapshot}>{children}</ArtViewerChromeContext.Provider>
  );
}

export function useArtViewerChrome(): ArtViewerChrome {
  const snapshot = useContext(ArtViewerChromeContext);
  if (!snapshot) throw new Error("useArtViewerChrome needs ArtViewerChromeProvider");
  return snapshot;
}
