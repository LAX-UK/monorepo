"use client";

import { useWatchlistToggle } from "@/lib/watchlist/use-watchlist-toggle";
import { Button } from "@auction/ui/components/button";
import { Bookmark, BookmarkPlus, Eye } from "lucide-react";
import Link from "next/link";

type Props = {
  lotId: string;
  initialWatching: boolean;
  isAuthenticated: boolean;
  /** `outlined-block` — saleroom lot card: 40px, light border #A3A3A3, 4px radius.
   * `default` — existing card / detail rail (unchanged for LSP).
   */
  appearance?: "default" | "outlined-block";
  loginNextPath: string;
  /** Alternate copy for scheduled / no-sale marketing CTAs (still toggles the same watchlist). */
  marketingCta?: "watchLot" | "notifyWhenOpens" | "notifyIfRelisted";
};

const lotBtnClass =
  "box-border inline-flex h-10 min-w-0 flex-1 items-center justify-center rounded-[4px] border border-brand-200 bg-transparent px-8 font-['DM_Sans',sans-serif] text-base font-semibold leading-6 tracking-[0.8px] text-brand-800 hover:bg-transparent hover:opacity-90 dark:border-outline-variant/50 dark:text-on-surface";

export function ArtworkWatchToggle({
  lotId,
  initialWatching,
  isAuthenticated,
  appearance = "default",
  loginNextPath,
  marketingCta = "watchLot",
}: Props) {
  const { watching, busy, error, toggle, loginHref } = useWatchlistToggle({
    lotId,
    initialWatching,
    isAuthenticated,
    loginNextPath,
  });

  const signInLabel =
    marketingCta === "notifyWhenOpens"
      ? "Sign in to get notified"
      : marketingCta === "notifyIfRelisted"
        ? "Sign in for relist alerts"
        : "Sign in to watch";

  const outlinedFollowLabel = marketingCta === "notifyIfRelisted" ? "Save lot" : "Follow";

  const defaultIdleLabel =
    marketingCta === "notifyWhenOpens"
      ? "Notify me when bidding opens"
      : marketingCta === "notifyIfRelisted"
        ? "Notify me if relisted"
        : "Watch lot";

  const defaultActiveLabel =
    marketingCta === "notifyWhenOpens"
      ? "You will be notified when bidding opens"
      : marketingCta === "notifyIfRelisted"
        ? "Watching for relist"
        : "Watching";

  const outlinedActiveLabel = marketingCta === "notifyIfRelisted" ? "Saved" : "Following";
  if (!isAuthenticated) {
    if (appearance === "outlined-block") {
      return (
        <Link
          href={loginHref}
          className={`${lotBtnClass} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-800 dark:focus-visible:outline-on-surface`}
        >
          {signInLabel}
        </Link>
      );
    }
    return (
      <Link
        href={loginHref}
        className="inline-flex items-center gap-2 rounded-md bg-surface-container-high px-4 py-2 font-label text-xs font-bold uppercase tracking-widest text-on-surface transition-colors hover:bg-surface-container"
      >
        <Eye className="size-4" aria-hidden />
        {signInLabel}
      </Link>
    );
  }

  const liveRegion = error ? (
    <output className="sr-only" aria-live="polite">
      {error}
    </output>
  ) : null;

  if (appearance === "outlined-block") {
    return (
      <>
        {liveRegion}
        <Button
          type="button"
          variant="ghost"
          disabled={busy}
          aria-pressed={watching}
          onClick={() => void toggle()}
          className={`${lotBtnClass} ${watching ? "border-primary/40 bg-primary/5" : ""}`}
        >
          {watching ? outlinedActiveLabel : outlinedFollowLabel}
        </Button>
      </>
    );
  }

  return (
    <>
      {liveRegion}
      <Button
        type="button"
        variant="secondary"
        disabled={busy}
        aria-pressed={watching}
        onClick={() => void toggle()}
        className={`h-auto gap-2 rounded-md px-4 py-2 font-label text-xs font-bold uppercase tracking-widest ${
          watching
            ? "bg-primary-container/30 text-primary hover:bg-primary-container/30"
            : "bg-surface-container-high text-on-surface hover:bg-surface-container"
        }`}
      >
        {watching ? (
          <Bookmark className="size-4" aria-hidden />
        ) : (
          <BookmarkPlus className="size-4" aria-hidden />
        )}
        {watching ? defaultActiveLabel : defaultIdleLabel}
      </Button>
    </>
  );
}
