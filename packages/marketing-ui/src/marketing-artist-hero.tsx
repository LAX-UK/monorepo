import { cn } from "@auction/ui";
import type { ReactNode } from "react";

export type MarketingArtistHeroProps = {
  name: string;
  /** Short line above the name, e.g. "Featured artist" or "Editions by". */
  eyebrow?: ReactNode;
  /** `MarketingArtistFacts` line under the name. */
  facts?: ReactNode;
  /** Product badges, e.g. Verified. */
  badges?: ReactNode;
  /** Short introduction, usually `MarketingReadMore` around the short biography. */
  summary?: ReactNode;
  /** Follow, share and similar controls. */
  actions?: ReactNode;
  /** `MarketingArtistCrossLinks` to the artist elsewhere at LAX. */
  crossLinks?: ReactNode;
  /**
   * Portrait image filling its frame (absolutely positioned, `object-cover`). The column is
   * left out entirely when there is no portrait, so the page never shows an empty frame.
   */
  portrait?: ReactNode;
  /** `compact` for product views of an artist (Shop editions); `default` for full profiles. */
  size?: "default" | "compact";
  headingId?: string;
  className?: string;
};

/**
 * The artist hero shared by LAX Bid, LAX Shop and lax.art: portrait on a mat beside the name,
 * facts, a short introduction, actions and links to the artist elsewhere at LAX.
 */
export function MarketingArtistHero({
  name,
  eyebrow,
  facts,
  badges,
  summary,
  actions,
  crossLinks,
  portrait,
  size = "default",
  headingId = "artist-hero-title",
  className,
}: MarketingArtistHeroProps) {
  const compact = size === "compact";
  return (
    <section
      aria-labelledby={headingId}
      data-testid="marketing-artist-hero"
      className={cn(
        "grid gap-8 md:items-center md:gap-12 lg:gap-16",
        portrait
          ? compact
            ? "md:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]"
            : "md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]"
          : undefined,
        className,
      )}
    >
      {portrait ? (
        <div
          className={cn(
            "relative aspect-[4/5] w-full overflow-hidden bg-surface-container-low",
            compact ? "max-w-[14rem] md:max-w-[20rem]" : "max-w-[18rem] md:max-w-none",
          )}
        >
          {portrait}
        </div>
      ) : null}
      <div className="flex min-w-0 flex-col items-start gap-5 md:gap-6">
        <div className="flex flex-col gap-3">
          {eyebrow ? (
            <p className="font-body text-sm font-medium leading-5 text-on-surface-variant">
              {eyebrow}
            </p>
          ) : null}
          <h1
            id={headingId}
            className={cn(
              "text-balance font-headline font-semibold tracking-tight text-on-surface",
              compact
                ? "text-[length:clamp(2rem,4vw,3.25rem)] leading-[1.1]"
                : "text-[length:clamp(2.25rem,5vw,4.5rem)] leading-[1.05]",
            )}
          >
            {name}
          </h1>
          {facts}
        </div>
        {badges ? <div className="flex flex-wrap items-center gap-2">{badges}</div> : null}
        {summary ? (
          <div className="max-w-prose font-body text-base leading-7 text-on-surface-variant">
            {summary}
          </div>
        ) : null}
        {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
        {crossLinks ? <div className="w-full max-w-prose">{crossLinks}</div> : null}
      </div>
    </section>
  );
}
