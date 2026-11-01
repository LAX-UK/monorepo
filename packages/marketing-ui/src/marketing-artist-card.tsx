import { FOCUS_RING } from "@auction/branding";
import { cn } from "@auction/ui";
import { MediaPlaceholder } from "@auction/ui/components/media-placeholder";
import Link from "next/link";
import { Children, type ReactNode, isValidElement } from "react";
import { MarketingCardMedia } from "./marketing-card-media.js";
import { MarketingCardReveal } from "./motion/index.js";

export type MarketingArtistCardProps = {
  href: string;
  name: string;
  /** h2 on the directory, h3 or h4 inside titled sections. */
  nameAs?: "h2" | "h3" | "h4";
  /** Portrait filling the frame (absolutely positioned, `object-cover`). Initials show without one. */
  portrait?: ReactNode;
  /** Plain facts line, e.g. "British · b. 1956". */
  facts?: string | null;
  /** What this product holds for the artist, e.g. "12 lots" or "3 editions". */
  caption?: ReactNode;
  /**
   * A representative work for an artist without a portrait: shown whole on the paper mat, as on
   * the work cards.
   */
  work?: ReactNode;
  /**
   * What an artist with neither portrait nor work gets. `placeholder` keeps the hatched initials
   * (Shop and lax.art); `text` is a card of text only: name, facts and caption, no image area.
   */
  withoutImage?: "placeholder" | "text";
  /** Badges over the top-left of the portrait, e.g. Featured. */
  badges?: ReactNode;
  /** Icon control over the bottom-right of the portrait, e.g. a watch heart. */
  overlayAction?: ReactNode;
  /** Control beside the name, e.g. a Follow button. */
  action?: ReactNode;
  /** Smaller type and spacing for rails. */
  density?: "default" | "compact";
  className?: string;
};

export function marketingArtistInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

/** Artist directory card shared by LAX Bid, LAX Shop and lax.art. */
export function MarketingArtistCard({
  href,
  name,
  nameAs: Name = "h2",
  portrait,
  work,
  withoutImage = "placeholder",
  facts,
  caption,
  badges,
  overlayAction,
  action,
  density = "default",
  className,
}: MarketingArtistCardProps) {
  const compact = density === "compact";
  const textOnly = !portrait && !work && withoutImage === "text";
  return (
    <article
      className={cn(
        "group relative flex min-w-0 flex-col",
        textOnly ? "h-auto" : "h-full",
        textOnly && "rounded-xl border border-border-hairline p-4",
        className,
      )}
      data-testid="marketing-artist-card"
    >
      {portrait || work || withoutImage === "placeholder" ? (
        <MarketingCardMedia
          className={cn(
            "aspect-[4/5]",
            work && !portrait ? "marketing-work-mat" : "bg-surface-container-low",
          )}
        >
          <Link
            href={href}
            tabIndex={-1}
            aria-hidden
            className={cn("absolute inset-0 block", work && !portrait && "p-[7%]")}
          >
            {portrait ??
              (work ? (
                <span className="relative block size-full [&_img]:!object-contain">{work}</span>
              ) : (
                <>
                  <MediaPlaceholder fill />
                  <span className="absolute inset-0 flex items-center justify-center font-headline text-4xl font-medium tracking-tight text-on-surface-variant">
                    {marketingArtistInitials(name)}
                  </span>
                </>
              ))}
          </Link>
          {badges ? (
            <div className="pointer-events-none absolute left-2 top-2 z-[1] flex flex-wrap gap-1">
              {badges}
            </div>
          ) : null}
          {overlayAction ? (
            <div className="absolute bottom-2 right-2 z-10">{overlayAction}</div>
          ) : null}
        </MarketingCardMedia>
      ) : null}
      <div
        className={cn(
          "flex min-w-0 flex-1 flex-col",
          textOnly ? "" : compact ? "pt-2" : "pt-3 md:pt-4",
        )}
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
          <div className="flex min-w-0 flex-col gap-0.5">
            <Name
              className={cn(
                "line-clamp-2 font-headline font-medium text-on-surface",
                compact ? "text-sm leading-5" : "text-base leading-6 md:text-lg md:leading-7",
              )}
            >
              <Link
                href={href}
                className={cn("rounded-sm underline-offset-4 hover:underline", FOCUS_RING)}
              >
                {name}
              </Link>
            </Name>
            {facts ? (
              <p className="line-clamp-1 font-body text-sm leading-5 text-on-surface-variant">
                {facts}
              </p>
            ) : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
        {caption ? (
          <p className="mt-auto pt-2 font-body text-sm font-medium leading-5 text-on-surface">
            {caption}
          </p>
        ) : null}
      </div>
    </article>
  );
}

export const MARKETING_ARTIST_GRID_CLASS =
  "grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 lg:gap-x-6 2xl:grid-cols-4";

export type MarketingArtistGridProps = {
  children: ReactNode;
  "aria-label"?: string;
  className?: string;
};

/** Directory grid: two columns on phones, three beside the filter rail, four on wide screens. */
export function MarketingArtistGrid({
  children,
  "aria-label": ariaLabel,
  className,
}: MarketingArtistGridProps) {
  return (
    <ul
      className={cn(MARKETING_ARTIST_GRID_CLASS, className)}
      aria-label={ariaLabel}
      data-testid="marketing-artist-grid"
    >
      {Children.toArray(children).map((child, index) => (
        <li
          key={isValidElement(child) && child.key != null ? child.key : index}
          className="min-w-0"
        >
          <MarketingCardReveal index={index}>{child}</MarketingCardReveal>
        </li>
      ))}
    </ul>
  );
}
