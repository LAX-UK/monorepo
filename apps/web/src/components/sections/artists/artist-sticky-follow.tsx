"use client";

import { ArtistWatchToggle } from "@/components/marketing/artist-watch-toggle";
import { useEffect, useState } from "react";

type Props = {
  artistId: string;
  artistName: string;
  initialWatching: boolean;
  isAuthenticated: boolean;
  loginNextPath: string;
};

/** Mobile-first sticky bottom bar with Follow CTA. Reveals after the user
 * scrolls past the hero so the page entry stays clean. Hidden on lg+ where the
 * hero CTA is always visible.
 */
export function ArtistStickyFollow({
  artistId,
  artistName,
  initialWatching,
  isAuthenticated,
  loginNextPath,
}: Props) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(() => {
        const threshold = window.innerHeight * 0.6;
        setShow(window.scrollY > threshold);
        raf = 0;
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div
      aria-hidden={!show}
      className={`pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center px-4 pb-4 transition-opacity duration-200 lg:hidden ${
        show ? "opacity-100" : "opacity-0"
      }`}
    >
      <div className="pointer-events-auto flex w-full max-w-md items-center justify-between gap-3 rounded-full border border-outline-variant/30 bg-surface/95 px-4 py-2 shadow-lg backdrop-blur">
        <p className="min-w-0 truncate font-headline text-sm text-on-surface">{artistName}</p>
        <ArtistWatchToggle
          artistId={artistId}
          initialWatching={initialWatching}
          isAuthenticated={isAuthenticated}
          loginNextPath={loginNextPath}
        />
      </div>
    </div>
  );
}
