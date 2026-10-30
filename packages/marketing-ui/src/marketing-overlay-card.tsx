import { FOCUS_RING } from "@auction/branding";
import { cn } from "@auction/ui";
import Link from "next/link";
import type { ComponentType, ReactNode } from "react";
import { MarketingCardMedia } from "./marketing-card-media.js";

type OverlayCardLinkProps = { href: string; className?: string; children: ReactNode };

export type MarketingOverlayCardProps = {
  /** Fills the card (`absolute inset-0 size-full`, `object-cover`). */
  media: ReactNode;
  /** Short parts divided by a rule, e.g. ["Exhibition", "London"]. */
  kicker?: readonly string[];
  title: string;
  /** Lines under the title: dates, then time and place. */
  details?: readonly string[];
  /** Missing href renders the title as plain text. */
  href?: string | null;
  /** Products route CMS links through their own safe-link component; defaults to `next/link`. */
  linkAs?: ComponentType<OverlayCardLinkProps>;
  /**
   * `cinema`: 4:5 on phones, 16:10 from `sm` (Figma Art Hub slide, 1220×760). `wide`: 4:5 on
   * phones, 21:10 from `sm`, for a single feature spanning the content width.
   */
  aspect?: "cinema" | "wide";
  headingLevel?: "h2" | "h3";
  "data-testid"?: string;
};

const ASPECT_CLASS = {
  cinema: "aspect-[4/5] sm:aspect-[16/10]",
  wide: "aspect-[4/5] sm:aspect-[21/10]",
} as const;

/*
 * The same scrim and on-media text as the media page title, so every caption over an image in
 * LAX keeps 4.5:1 against the brightest photograph.
 */
const SCRIM = "bg-[var(--color-scrim-page-title,rgb(0_0_0/0.6))]";
const ON_MEDIA_TEXT = "text-[color:var(--color-hero-foreground,#fff)]";

/**
 * A card whose caption sits centred over its image (Figma Art Hub "Happening now", `992:14233`):
 * kicker, title and details on a scrim. The title link stretches over the card, so the whole
 * image is one tab stop.
 */
export function MarketingOverlayCard({
  media,
  kicker = [],
  title,
  details = [],
  href,
  linkAs: LinkComponent = Link,
  aspect = "cinema",
  headingLevel = "h3",
  "data-testid": testId,
}: MarketingOverlayCardProps) {
  const Heading = headingLevel;
  return (
    <article className="group relative" data-testid={testId}>
      <MarketingCardMedia className={cn("bg-surface-container", ASPECT_CLASS[aspect])}>
        {media}
        <div aria-hidden className={cn("absolute inset-0", SCRIM)} />
      </MarketingCardMedia>
      <div
        className={cn(
          "absolute inset-0 flex flex-col items-center justify-center gap-4 px-6 text-center sm:px-16",
          ON_MEDIA_TEXT,
        )}
      >
        {kicker.length > 0 ? (
          <p className="flex flex-wrap items-center justify-center font-label text-sm leading-5 sm:text-base">
            {kicker.map((part, index) => (
              <span
                key={part}
                className={cn(
                  index > 0 && "pl-3",
                  index < kicker.length - 1 && "border-r border-current pr-3",
                )}
              >
                {part}
              </span>
            ))}
          </p>
        ) : null}
        <Heading className="max-w-[40rem] text-balance font-headline text-[length:clamp(1.75rem,4vw,3rem)] font-medium leading-[1.15]">
          {href ? (
            <LinkComponent
              href={href}
              className={cn(
                "rounded-sm underline-offset-[6px] after:absolute after:inset-0 group-hover:underline",
                FOCUS_RING,
              )}
            >
              {title}
            </LinkComponent>
          ) : (
            title
          )}
        </Heading>
        {details.length > 0 ? (
          <div className="flex flex-col gap-1 font-body text-base leading-6 sm:text-lg sm:leading-7">
            {details.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        ) : null}
      </div>
    </article>
  );
}
