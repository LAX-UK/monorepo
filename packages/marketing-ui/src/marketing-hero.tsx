import { cn } from "@auction/ui";
import type { ReactNode } from "react";

export type MarketingHeroProps = {
  media: ReactNode;
  children: ReactNode;
  className?: string;
  panelClassName?: string;
};

/** Full-bleed media with a frosted content panel (layout only; tokens from page). */
export function MarketingHero({ media, children, className, panelClassName }: MarketingHeroProps) {
  return (
    <section className={cn("relative isolate min-h-[min(70vh,640px)] overflow-hidden", className)}>
      <div className="absolute inset-0 -z-10 [&_img]:size-full [&_img]:object-cover">{media}</div>
      <div className="absolute inset-0 -z-[9] bg-gradient-to-t from-page-bg/90 via-page-bg/40 to-transparent" />
      <div
        className={cn(
          "mx-auto flex max-w-[var(--container-max,90rem)] items-end px-[var(--page-gutter-x,1.25rem)] pb-10 pt-32 sm:pb-14",
          panelClassName,
        )}
      >
        <div className="max-w-xl rounded-lg border border-outline-variant/30 bg-surface/85 p-6 shadow-sm backdrop-blur-md dark:bg-surface-container/90">
          {children}
        </div>
      </div>
    </section>
  );
}
