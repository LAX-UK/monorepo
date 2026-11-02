import { FOCUS_RING } from "@auction/branding";
import { cn } from "@auction/ui";
import Link from "next/link";
import type { ReactNode } from "react";
import { MarketingSplitFeature } from "./marketing-split-feature.js";

export type MarketingArtistFeatureProps = {
  name: string;
  /** Where the portrait leads; the portrait is decorative, the name's link is the action. */
  href: string;
  /** Portrait content filling a 4:5 frame (`MarketingArtistPortraitFill`). */
  portrait: ReactNode;
  eyebrow?: ReactNode;
  /** "Painter · British, b. 1979". */
  facts?: string | null;
  /** Two lines at most. */
  bio?: string | null;
  /** What the product holds for the artist, e.g. "4 editions in the Shop" or "4 works". */
  count?: string | null;
  /** Buttons and links under the copy. */
  actions?: ReactNode;
  className?: string;
};

/**
 * One artist, told at length: the portrait at its own 4:5 shape against the page edge beside
 * the name, facts, a short bio, a count and the actions. The feature stands on the page itself,
 * so only the portrait reads as a frame; on phones the portrait stays a portrait instead of
 * filling the first screen. The product supplies copy and links.
 */
export function MarketingArtistFeature({
  name,
  href,
  portrait,
  eyebrow,
  facts,
  bio,
  count,
  actions,
  className,
}: MarketingArtistFeatureProps) {
  return (
    <MarketingSplitFeature
      tone="plain"
      mediaSide="left"
      title={name}
      {...(eyebrow ? { eyebrow } : {})}
      className={cn(
        "bg-transparent md:gap-12",
        "[&>:first-child]:aspect-[4/5] [&>:first-child]:w-[min(60%,16rem)] md:[&>:first-child]:aspect-auto md:[&>:first-child]:w-auto",
        "[&>:last-child]:px-0 md:[&>:last-child]:pe-8",
        className,
      )}
      media={
        <div className="absolute inset-0 flex items-center justify-start">
          <Link
            href={href}
            tabIndex={-1}
            aria-hidden="true"
            className="relative block aspect-[4/5] max-h-full w-full max-w-full overflow-hidden bg-surface-container-low md:h-full md:w-auto"
          >
            {portrait}
          </Link>
        </div>
      }
      body={
        <div className="flex flex-col items-start gap-2 text-on-surface [&>p]:m-0">
          {facts ? <p className="text-on-surface-variant">{facts}</p> : null}
          {bio ? <p className="line-clamp-2 max-w-[34rem]">{bio}</p> : null}
          {count ? (
            <p className="pt-1 text-lg font-semibold leading-relaxed tabular-nums text-on-surface">
              {count}
            </p>
          ) : null}
        </div>
      }
      {...(actions
        ? { action: <div className="flex flex-wrap items-center gap-x-6 gap-y-3">{actions}</div> }
        : {})}
    />
  );
}

export type MarketingArtistPairRowProps = {
  name: string;
  href: string;
  /** Portrait content filling a 4:5 frame (`MarketingArtistPortraitFill`). */
  portrait: ReactNode;
  /** Discipline; left out when empty. */
  facts?: string | null;
  /** E.g. "4 editions" or "4 works". */
  count?: string | null;
  /** The link under the count, e.g. "Editions by Flora Powers". */
  linkLabel: string;
};

/** One of two artists side by side: a portrait beside the name, facts, count and link. */
export function MarketingArtistPairRow({
  name,
  href,
  portrait,
  facts,
  count,
  linkLabel,
}: MarketingArtistPairRowProps) {
  return (
    <article className="grid grid-cols-[7rem_minmax(0,1fr)] items-center gap-4 lg:grid-cols-[10rem_minmax(0,1fr)] lg:gap-6">
      <Link
        href={href}
        tabIndex={-1}
        aria-hidden="true"
        className="relative block aspect-[4/5] overflow-hidden bg-surface-container-low"
      >
        {portrait}
      </Link>
      <div className="flex min-w-0 flex-col items-start gap-1">
        <h3 className="m-0 line-clamp-2 font-headline text-xl font-medium leading-7 text-on-surface">
          {name}
        </h3>
        {facts ? <p className="m-0 text-sm leading-5 text-on-surface-variant">{facts}</p> : null}
        {count ? (
          <p className="m-0 mt-1 text-sm font-medium leading-5 text-on-surface">{count}</p>
        ) : null}
        <Link
          href={href}
          className={cn(
            "mt-2 rounded-sm text-sm leading-normal text-link underline decoration-1 underline-offset-[0.25em] hover:decoration-2",
            FOCUS_RING,
          )}
        >
          {linkLabel}
        </Link>
      </div>
    </article>
  );
}

export type MarketingArtistPairProps = {
  "aria-label": string;
  children: ReactNode;
};

/** The pair's list: one column on phones, two side by side from 48rem. `children` are `li`s. */
export function MarketingArtistPair({
  "aria-label": ariaLabel,
  children,
}: MarketingArtistPairProps) {
  return (
    <ul aria-label={ariaLabel} className="m-0 grid list-none gap-x-12 gap-y-8 p-0 md:grid-cols-2">
      {children}
    </ul>
  );
}
