import { cn } from "@auction/ui";
import { type ReactNode, useId } from "react";
import { MARKETING_SURFACE_TONE, type MarketingSurfaceTone } from "./marketing-surface-tone.js";

export type MarketingSplitFeatureProps = {
  title: ReactNode;
  eyebrow?: ReactNode;
  body?: ReactNode;
  /** Usually one button or link; rendered under the body. */
  action?: ReactNode;
  /**
   * Media filling its half (`absolute inset-0 size-full object-cover`). Without media the panel
   * does not split: the copy is centred on the band, so no half is left empty.
   */
  media?: ReactNode;
  /** Desktop side of the media. */
  mediaSide?: "left" | "right";
  /**
   * Order on small screens, where the halves stack. `media-first` (default) puts the media above
   * the panel; `text-first` leads with the copy, for a page hero whose title should be the
   * first thing a phone shows.
   */
  mobileOrder?: "media-first" | "text-first";
  tone?: MarketingSurfaceTone;
  /**
   * A compact panel for a secondary prompt: one row from md up (`leading`, the copy, the action),
   * stacked on a phone, with a heading-sized title. Ignores `media`.
   */
  compact?: boolean;
  /** Small pictures at the start of a compact row. */
  leading?: ReactNode;
  /** `h1` when the feature leads the page. */
  headingLevel?: "h1" | "h2" | "h3";
  className?: string;
};

/** Full-bleed media + copy panel promo (Figma home guide promo, `299:4150`); centred text without media. */
export function MarketingSplitFeature({
  title,
  eyebrow,
  body,
  action,
  media,
  mediaSide = "right",
  mobileOrder = "media-first",
  tone = "feature",
  compact = false,
  leading,
  headingLevel: Heading = "h2",
  className,
}: MarketingSplitFeatureProps) {
  const headingId = useId();
  const toneClass = MARKETING_SURFACE_TONE[tone];

  if (compact) {
    return (
      <section
        aria-labelledby={headingId}
        data-compact=""
        className={cn(
          "grid items-center gap-4 px-5 py-6 md:gap-8 md:px-8",
          leading
            ? "md:grid-cols-[auto_minmax(0,1fr)_minmax(0,auto)]"
            : "md:grid-cols-[minmax(0,1fr)_minmax(0,auto)]",
          toneClass.surface,
          className,
        )}
      >
        {leading ? <div className="flex items-center justify-start">{leading}</div> : null}
        <div className="min-w-0">
          {eyebrow ? <p className="m-0 mb-1 font-label text-xs font-medium">{eyebrow}</p> : null}
          <Heading
            id={headingId}
            className="m-0 text-balance font-headline text-xl font-medium leading-7"
          >
            {title}
          </Heading>
          {body ? (
            <div className={cn("mt-1 text-sm leading-[22px]", toneClass.body)}>{body}</div>
          ) : null}
        </div>
        {action ? <div className="flex min-w-0 flex-wrap items-center gap-3">{action}</div> : null}
      </section>
    );
  }

  return (
    <section
      aria-labelledby={headingId}
      className={cn("grid", media ? "md:grid-cols-2" : null, toneClass.surface, className)}
      data-media-side={media ? mediaSide : undefined}
      data-mobile-order={media ? mobileOrder : undefined}
    >
      {media ? (
        <div
          className={cn(
            "relative aspect-[4/3] overflow-hidden md:aspect-auto md:min-h-[min(37.5rem,60vw)]",
            mobileOrder === "text-first" && "order-last",
            mediaSide === "right"
              ? "md:order-last"
              : mobileOrder === "text-first" && "md:order-first",
          )}
          data-testid="marketing-split-feature-media"
        >
          {media}
        </div>
      ) : null}
      <div
        className={cn(
          "flex flex-col justify-center gap-6 px-4 py-12 sm:px-10 md:py-16 lg:px-20",
          media ? null : "items-center text-center",
        )}
      >
        <div
          className={cn(
            "flex flex-col gap-4",
            media ? "max-w-[35rem]" : "max-w-[44rem] items-center",
          )}
        >
          {eyebrow ? <p className="font-label text-xs font-medium">{eyebrow}</p> : null}
          <Heading
            id={headingId}
            className="m-0 text-balance font-headline text-[length:var(--text-title-promo,clamp(1.75rem,3.2vw,2.75rem))] font-normal leading-[1.15]"
          >
            {title}
          </Heading>
          {body ? (
            <div
              className={cn(
                "text-base leading-relaxed",
                toneClass.body,
                media ? null : "max-w-[52ch]",
              )}
            >
              {body}
            </div>
          ) : null}
        </div>
        {action ? (
          <div className={cn("flex flex-wrap gap-3", media ? null : "justify-center")}>
            {action}
          </div>
        ) : null}
      </div>
    </section>
  );
}
