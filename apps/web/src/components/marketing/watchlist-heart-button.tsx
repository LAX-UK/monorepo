"use client";

import { WatchlistHeart } from "@/components/marketing/watchlist-heart";
import { useWatchlistToggle } from "@/lib/watchlist/use-watchlist-toggle";
import { cn } from "@auction/ui";
import { Heart } from "lucide-react";
import Link from "next/link";

const heartShellClass =
  "inline-flex size-9 items-center justify-center rounded-full bg-white/30 text-white backdrop-blur-sm transition-colors hover:bg-white/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-brand motion-reduce:transition-none";

type LayoutMode = "overlay" | "inline";

type Props = {
  lotId: string;
  lotTitle: string;
  initialWatching: boolean;
  isAuthenticated: boolean;
  loginNextPath: string;
  className?: string;
  /** `overlay`: absolute top-right on lot cards. `inline`: flow layout for list rows. */
  layout?: LayoutMode;
};

const inlineHeartShellClass =
  "inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-outline-variant/40 bg-surface-container-high text-on-surface backdrop-blur-none transition-colors hover:bg-surface-container-highest focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-brand motion-reduce:transition-none";

/** Wires `WatchlistHeart` to the watchlist API; logged-out users go to `/login?next=`. */
export function MarketingWatchlistHeart({
  lotId,
  lotTitle,
  initialWatching,
  isAuthenticated,
  loginNextPath,
  className,
  layout = "overlay",
}: Props) {
  const { watching, busy, error, announce, toggle, loginHref } = useWatchlistToggle({
    lotId,
    initialWatching,
    isAuthenticated,
    loginNextPath,
  });

  const liveText = error ?? announce ?? "";

  const positionClass =
    layout === "inline" ? "relative shrink-0" : "pointer-events-auto absolute right-3 top-3 z-10";

  if (!isAuthenticated) {
    return (
      <Link
        href={loginHref}
        className={cn(
          layout === "inline" ? inlineHeartShellClass : heartShellClass,
          positionClass,
          className,
        )}
        aria-label={`Sign in to add ${lotTitle} to your watchlist`}
      >
        <Heart className="size-5 fill-transparent stroke-current" aria-hidden />
      </Link>
    );
  }

  return (
    <>
      <output className="sr-only" aria-live="polite">
        {liveText}
      </output>
      <WatchlistHeart
        pressed={watching}
        onChange={() => void toggle()}
        lotTitle={lotTitle}
        disabled={busy}
        className={cn(
          layout === "inline" ? inlineHeartShellClass : heartShellClass,
          positionClass,
          className,
        )}
      />
    </>
  );
}
