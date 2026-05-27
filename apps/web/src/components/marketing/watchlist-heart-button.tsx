"use client";

import { WatchlistHeart } from "@/components/marketing/watchlist-heart";
import { useOverlayTone, useOverlayToneContext } from "@/components/ui/overlay-tone-context";
import { overlayIconButtonClasses, overlayToneProps } from "@/lib/ui/overlay-tone-classes";
import { useWatchlistToggle } from "@/lib/watchlist/use-watchlist-toggle";
import { cn } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import { Heart } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback } from "react";

const inlineHeartShellClass =
  "inline-flex min-h-[var(--tap-target-min,44px)] min-w-[var(--tap-target-min,44px)] shrink-0 items-center justify-center rounded-full border border-outline-variant/40 bg-surface-container-high text-on-surface backdrop-blur-none transition-colors hover:bg-surface-container-highest focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-brand motion-reduce:transition-none";

type LayoutMode = "overlay" | "inline";

type Props = {
  lotId: string;
  lotTitle: string;
  initialWatching: boolean;
  isAuthenticated: boolean;
  loginNextPath: string;
  className?: string;
  layout?: LayoutMode;
};

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
  const router = useRouter();
  const { watching, busy, error, announce, toggle, loginHref } = useWatchlistToggle({
    lotId,
    initialWatching,
    isAuthenticated,
    loginNextPath,
  });

  const liveText = error ?? announce ?? "";

  const positionClass =
    layout === "inline" ? "relative shrink-0" : "pointer-events-auto absolute right-3 top-3 z-10";

  const inFrame = useOverlayToneContext() != null;
  const overlayTone = useOverlayTone("topRight");
  const imageAwareShell = overlayIconButtonClasses(
    overlayTone,
    "min-h-[var(--tap-target-min,44px)] min-w-[var(--tap-target-min,44px)]",
  );
  const useOverlayChrome = layout === "overlay" || inFrame;
  const shellClass = useOverlayChrome ? imageAwareShell : inlineHeartShellClass;
  const overlayProps = overlayToneProps(overlayTone);

  const onLoginClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();
      router.push(loginHref);
    },
    [loginHref, router],
  );

  if (!isAuthenticated) {
    return (
      <Button
        type="button"
        variant="ghost"
        onClick={onLoginClick}
        className={cn(shellClass, positionClass, className)}
        {...(useOverlayChrome ? overlayProps : {})}
        aria-label={`Sign in to add ${lotTitle} to your watchlist`}
      >
        <Heart className="size-5 fill-transparent stroke-current" aria-hidden />
      </Button>
    );
  }

  return (
    <span className="contents">
      <output className="sr-only" aria-live="polite">
        {liveText}
      </output>
      <WatchlistHeart
        pressed={watching}
        onChange={() => void toggle()}
        lotTitle={lotTitle}
        disabled={busy}
        className={cn(shellClass, positionClass, className)}
        {...(useOverlayChrome ? overlayProps : {})}
      />
    </span>
  );
}
