import { cn } from "@auction/ui";
import { type ReactNode, useId } from "react";
import { MARKETING_SURFACE_TONE, type MarketingSurfaceTone } from "./marketing-surface-tone.js";

export type MarketingSplitFeatureProps = {
  title: ReactNode;
  eyebrow?: ReactNode;
  body?: ReactNode;
  /** Usually one button or link; rendered under the body. */
  action?: ReactNode;
  /** Media filling its half (`absolute inset-0 size-full object-cover`). Omitted → text-only panel. */
  media?: ReactNode;
  /** Desktop side of the media; on small screens media always sits above the panel. */
  mediaSide?: "left" | "right";
  tone?: MarketingSurfaceTone;
  /** `h1` when the feature leads the page. */
  headingLevel?: "h1" | "h2" | "h3";
  className?: string;
};

/** Full-bleed media + copy panel promo (Figma home guide promo, `299:4150`). */
export function MarketingSplitFeature({
  title,
  eyebrow,
  body,
  action,
  media,
  mediaSide = "right",
  tone = "feature",
  headingLevel: Heading = "h2",
  className,
}: MarketingSplitFeatureProps) {
  const headingId = useId();
  const toneClass = MARKETING_SURFACE_TONE[tone];

  return (
    <section
      aria-labelledby={headingId}
      className={cn("grid", media ? "md:grid-cols-2" : null, toneClass.surface, className)}
      data-media-side={media ? mediaSide : undefined}
    >
      {media ? (
        <div
          className={cn(
            "relative aspect-[4/3] overflow-hidden md:aspect-auto md:min-h-[min(37.5rem,60vw)]",
            mediaSide === "right" ? "md:order-last" : null,
          )}
        >
          {media}
        </div>
      ) : null}
      <div className="flex flex-col justify-center gap-6 px-4 py-12 sm:px-10 md:py-16 lg:px-20">
        <div className="flex max-w-[35rem] flex-col gap-4">
          {eyebrow ? (
            <p className="font-label text-xs font-medium uppercase tracking-[0.12em]">{eyebrow}</p>
          ) : null}
          <Heading
            id={headingId}
            className="m-0 font-headline text-[length:var(--text-title-promo,clamp(1.75rem,3.2vw,2.75rem))] font-normal leading-[1.15]"
          >
            {title}
          </Heading>
          {body ? (
            <div className={cn("text-base leading-relaxed", toneClass.body)}>{body}</div>
          ) : null}
        </div>
        {action ? <div className="flex flex-wrap gap-3">{action}</div> : null}
      </div>
    </section>
  );
}
