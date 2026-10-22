import { cn } from "@auction/ui";
import { type ReactNode, useId } from "react";
import { MARKETING_SURFACE_TONE, type MarketingSurfaceTone } from "./marketing-surface-tone.js";

export type MarketingCtaBandProps = {
  title: ReactNode;
  body?: ReactNode;
  /** Usually one button; centred under the copy. */
  action?: ReactNode;
  tone?: MarketingSurfaceTone;
  /**
   * Full-bleed image behind the copy (`absolute inset-0 size-full object-cover`). Replaces the
   * tone surface with a dark scrim and light text (Figma "Curious to learn more?", `782:11154`).
   */
  media?: ReactNode;
  className?: string;
};

/** Full-width centred closing call to action (Figma home "Take the conversation further", `299:4579`). */
export function MarketingCtaBand({
  title,
  body,
  action,
  tone = "plain",
  media,
  className,
}: MarketingCtaBandProps) {
  const headingId = useId();
  const toneClass = MARKETING_SURFACE_TONE[tone];

  return (
    <section
      aria-labelledby={headingId}
      className={cn(
        "px-4 py-16 sm:px-10 md:py-24",
        media
          ? "relative isolate overflow-hidden text-[color:var(--color-hero-foreground,#fff)]"
          : toneClass.surface,
        className,
      )}
    >
      {media ? (
        <>
          <div className="absolute inset-0 -z-20">{media}</div>
          <div
            aria-hidden
            className="absolute inset-0 -z-10 bg-[var(--color-scrim-page-title,rgb(0_0_0/0.6))]"
          />
        </>
      ) : null}
      <div className="mx-auto flex max-w-[62rem] flex-col items-center gap-6 text-center">
        <h2
          id={headingId}
          className="m-0 font-headline text-[length:var(--text-title-section,clamp(1.5rem,2.8vw,2.5rem))] font-normal leading-[1.2]"
        >
          {title}
        </h2>
        {body ? (
          <div
            className={cn("text-base leading-relaxed sm:text-lg", media ? null : toneClass.body)}
          >
            {body}
          </div>
        ) : null}
        {action ? <div className="flex flex-wrap justify-center gap-3 pt-2">{action}</div> : null}
      </div>
    </section>
  );
}
