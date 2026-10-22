import { FOCUS_RING } from "@auction/branding";
import { cn } from "@auction/ui";
import Link from "next/link";
import type { ComponentType, ReactNode } from "react";
import { MarketingCardMedia } from "./marketing-card-media.js";
import { MarketingArrowRightIcon, MarketingArrowUpRightIcon } from "./marketing-icons.js";
import { MARKETING_SURFACE_TONE } from "./marketing-surface-tone.js";

type FeatureCardLinkProps = { href: string; className?: string; children: ReactNode };

export type MarketingFeatureCardProps = {
  /**
   * `split`: copy beside media from `md` up (stacked below it). `vertical`: media above copy.
   * `text`: copy only.
   */
  variant?: "split" | "vertical" | "text";
  title: string;
  body?: string | null;
  /** Label of the trailing link affordance. */
  ctaLabel?: string;
  /** Fills the media slot (`absolute inset-0 size-full`); ignored by the `text` variant. */
  media?: ReactNode;
  /** Missing href renders the title as plain text and hides the affordance. */
  href?: string | null;
  /** Products route CMS links through their own safe-link component; defaults to `next/link`. */
  linkAs?: ComponentType<FeatureCardLinkProps>;
  headingLevel?: "h2" | "h3";
  "data-testid"?: string;
};

/** Cream, square-cornered Collector Hub card (Figma card set `782:11358`, mobile `780:9171`). */
export function MarketingFeatureCard({
  variant = "split",
  title,
  body,
  ctaLabel = "Learn more",
  media,
  href,
  linkAs: LinkComponent = Link,
  headingLevel: Heading = "h3",
  "data-testid": testId,
}: MarketingFeatureCardProps) {
  const showMedia = variant !== "text" && media != null;
  const split = variant === "split" && showMedia;

  return (
    <article
      className={cn(
        "group relative flex h-full overflow-hidden rounded-none",
        MARKETING_SURFACE_TONE.feature.surface,
        split ? "flex-col md:flex-row" : "flex-col",
      )}
      data-variant={variant}
      data-testid={testId}
    >
      <div
        className={cn(
          "flex flex-1 flex-col justify-center gap-4 p-6 md:gap-6 md:p-8",
          split ? "order-2 md:order-1 md:basis-1/2" : null,
        )}
      >
        <div className="flex items-start justify-between gap-4">
          <Heading className="m-0 font-headline text-xl font-medium leading-snug text-on-surface md:text-2xl">
            {href ? (
              <LinkComponent
                href={href}
                className={cn("rounded-sm after:absolute after:inset-0", FOCUS_RING)}
              >
                {title}
              </LinkComponent>
            ) : (
              title
            )}
          </Heading>
          {href ? <MarketingArrowUpRightIcon className="mt-1 md:hidden" /> : null}
        </div>
        {body ? (
          <p className="m-0 text-sm leading-relaxed text-on-surface-variant md:text-base">{body}</p>
        ) : null}
        {href ? (
          <span
            aria-hidden
            className="hidden items-center gap-2 font-label text-sm text-on-surface group-hover:underline md:inline-flex"
          >
            {ctaLabel}
            <MarketingArrowRightIcon className="size-4" />
          </span>
        ) : null}
      </div>
      {showMedia ? (
        <MarketingCardMedia
          className={cn(
            "bg-surface-container",
            split
              ? "order-1 aspect-[4/3] md:order-2 md:aspect-auto md:basis-1/2"
              : "order-first aspect-[4/3]",
          )}
        >
          {media}
        </MarketingCardMedia>
      ) : null}
    </article>
  );
}
