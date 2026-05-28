"use client";

import { useWatchlistToggle } from "@/lib/watchlist/use-watchlist-toggle";
import { Button } from "@auction/ui/components/button";
import { Bookmark, BookmarkCheck, Loader2, LogIn } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

type Props = {
  lotId: string;
  initialWatching: boolean;
  isAuthenticated: boolean;
  /** `outlined-block` — saleroom lot card: 40px, light border #A3A3A3, 4px radius.
   * `default` — existing card / detail rail (unchanged for LSP).
   * `list-action` — compact outline button for dashboard mobile list cards.
   */
  appearance?: "default" | "outlined-block" | "list-action";
  loginNextPath: string;
  /** Used for accessible labels when `appearance="list-action"`. */
  lotTitle?: string;
  /** Alternate copy for scheduled / no-sale marketing CTAs (still toggles the same watchlist). */
  marketingCta?: "watchLot" | "notifyWhenOpens" | "notifyIfRelisted";
};

const lotBtnClass =
  "box-border inline-flex h-10 min-w-0 flex-1 items-center justify-center gap-2 rounded-[4px] border border-brand-200 bg-transparent px-3 sm:px-6 font-['DM_Sans',sans-serif] text-base font-semibold leading-6 tracking-[0.8px] text-brand-800 hover:bg-transparent hover:opacity-90 dark:border-outline-variant/50 dark:text-on-surface";

export function ArtworkWatchToggle({
  lotId,
  initialWatching,
  isAuthenticated,
  appearance = "default",
  loginNextPath,
  lotTitle,
  marketingCta = "watchLot",
}: Props) {
  const { watching, busy, error, announce, toggle, loginHref } = useWatchlistToggle({
    lotId,
    initialWatching,
    isAuthenticated,
    loginNextPath,
  });

  // Bump-key: incremented on each toggle to restart the icon scale animation.
  const [bumpKey, setBumpKey] = useState(0);

  const signInLabel = "Sign in to watch";

  const outlinedFollowLabel = marketingCta === "notifyIfRelisted" ? "Save" : "Follow";

  const defaultIdleLabel =
    marketingCta === "notifyWhenOpens"
      ? "Get notified"
      : marketingCta === "notifyIfRelisted"
        ? "Notify me"
        : "Watch";

  const defaultActiveLabel = marketingCta === "notifyWhenOpens" ? "Notified" : "Watching";

  const outlinedActiveLabel = marketingCta === "notifyIfRelisted" ? "Saved" : "Following";

  const listActionIdleLabel = "Watch";
  const listActionActiveLabel = "Unwatch";

  const listActionAriaLabel = (watching: boolean) => {
    const verb = watching ? listActionActiveLabel : listActionIdleLabel;
    return lotTitle ? `${verb} ${lotTitle}` : verb;
  };

  const liveRegion = (
    <output className="sr-only" aria-live="polite">
      {error ?? announce ?? ""}
    </output>
  );

  if (!isAuthenticated) {
    if (appearance === "list-action") {
      return (
        <Link
          href={loginHref}
          className="inline-flex min-h-9 items-center gap-2 rounded-md border border-outline-variant/25 bg-surface-container-lowest px-3 py-2 text-xs font-medium text-on-surface shadow-sm transition-colors hover:bg-surface-container-low"
        >
          <LogIn className="size-4 shrink-0" aria-hidden />
          {signInLabel}
        </Link>
      );
    }
    if (appearance === "outlined-block") {
      return (
        <Link
          href={loginHref}
          className={`${lotBtnClass} whitespace-nowrap focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-800 dark:focus-visible:outline-on-surface`}
        >
          <LogIn className="size-4 shrink-0" aria-hidden />
          <span className="truncate">{signInLabel}</span>
        </Link>
      );
    }
    return (
      <Link
        href={loginHref}
        className="inline-flex items-center gap-2 rounded-md border border-outline-variant/30 bg-surface-container-high px-4 py-2 font-label text-xs font-bold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface transition-colors hover:bg-surface-container"
      >
        <LogIn className="size-4 shrink-0" aria-hidden />
        {signInLabel}
      </Link>
    );
  }

  function handleToggle() {
    setBumpKey((k) => k + 1);
    void toggle();
  }

  if (appearance === "outlined-block") {
    return (
      <>
        {liveRegion}
        <Button
          type="button"
          variant="ghost"
          disabled={busy}
          aria-pressed={watching}
          onClick={handleToggle}
          className={`${lotBtnClass} ${watching ? "border-primary/40 bg-primary/5" : ""}`}
        >
          {busy ? (
            <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
          ) : (
            <span
              key={bumpKey}
              className="inline-flex motion-safe:[animation:tick_var(--motion-duration-md,_320ms)_var(--motion-ease-emphasize)]"
              aria-hidden
            >
              {watching ? (
                <BookmarkCheck className="size-4 shrink-0 text-primary" />
              ) : (
                <Bookmark className="size-4 shrink-0" />
              )}
            </span>
          )}
          {watching ? outlinedActiveLabel : outlinedFollowLabel}
        </Button>
      </>
    );
  }

  if (appearance === "list-action") {
    return (
      <>
        {liveRegion}
        <Button
          type="button"
          variant="secondaryOutline"
          size="sm"
          disabled={busy}
          aria-pressed={watching}
          aria-label={listActionAriaLabel(watching)}
          onClick={handleToggle}
        >
          {busy ? (
            <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
          ) : (
            <span
              key={bumpKey}
              className="inline-flex motion-safe:[animation:tick_var(--motion-duration-md,_320ms)_var(--motion-ease-emphasize)]"
              aria-hidden
            >
              {watching ? (
                <BookmarkCheck className="size-4 shrink-0" />
              ) : (
                <Bookmark className="size-4 shrink-0" />
              )}
            </span>
          )}
          {watching ? listActionActiveLabel : listActionIdleLabel}
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
        onClick={handleToggle}
        className={`h-auto gap-2 rounded-md px-4 py-2 font-label text-xs font-bold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] ${
          watching
            ? "bg-primary-container/30 text-primary hover:bg-primary-container/30"
            : "bg-surface-container-high text-on-surface hover:bg-surface-container"
        }`}
      >
        {busy ? (
          <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
        ) : (
          <span
            key={bumpKey}
            className="inline-flex motion-safe:[animation:tick_var(--motion-duration-md,_320ms)_var(--motion-ease-emphasize)]"
            aria-hidden
          >
            {watching ? <BookmarkCheck className="size-4" /> : <Bookmark className="size-4" />}
          </span>
        )}
        {watching ? defaultActiveLabel : defaultIdleLabel}
      </Button>
    </>
  );
}
