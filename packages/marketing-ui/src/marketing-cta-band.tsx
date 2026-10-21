import { cn } from "@auction/ui";
import { type ReactNode, useId } from "react";
import { MARKETING_SURFACE_TONE, type MarketingSurfaceTone } from "./marketing-surface-tone.js";

export type MarketingCtaBandProps = {
  title: ReactNode;
  body?: ReactNode;
  /** Usually one button; centred under the copy. */
  action?: ReactNode;
  tone?: MarketingSurfaceTone;
  className?: string;
};

/** Full-width centred closing call to action (Figma home "Take the conversation further", `299:4579`). */
export function MarketingCtaBand({
  title,
  body,
  action,
  tone = "plain",
  className,
}: MarketingCtaBandProps) {
  const headingId = useId();
  const toneClass = MARKETING_SURFACE_TONE[tone];

  return (
    <section
      aria-labelledby={headingId}
      className={cn("px-4 py-16 sm:px-10 md:py-24", toneClass.surface, className)}
    >
      <div className="mx-auto flex max-w-[62rem] flex-col items-center gap-6 text-center">
        <h2
          id={headingId}
          className="m-0 font-headline text-[length:var(--text-title-section,clamp(1.5rem,2.8vw,2.5rem))] font-normal leading-[1.2]"
        >
          {title}
        </h2>
        {body ? (
          <div className={cn("text-base leading-relaxed sm:text-lg", toneClass.body)}>{body}</div>
        ) : null}
        {action ? <div className="flex flex-wrap justify-center gap-3 pt-2">{action}</div> : null}
      </div>
    </section>
  );
}
