import { MarketingLinkCard } from "@/components/marketing/marketing-link-card";
import { cn } from "@auction/ui";
import type { ReactNode } from "react";

export type ArtistCardGridProps = {
  href: string;
  "aria-label": string;
  cornerAction: ReactNode;
  portrait: ReactNode;
  badges: ReactNode;
  title: ReactNode;
  meta: ReactNode;
  bio?: ReactNode;
  /** Row under the main link (e.g. “N lots” + “View profile”). */
  footer: ReactNode;
  className?: string;
};

/** Directory `4/5` portrait tile — watch heart in `cornerAction`, badges top-left. */
export function ArtistCardGrid({
  href,
  "aria-label": ariaLabel,
  cornerAction,
  portrait,
  badges,
  title,
  meta,
  bio,
  footer,
  className,
}: ArtistCardGridProps) {
  return (
    <li
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-xl border border-outline-variant/15 bg-surface shadow-sm transition hover:border-primary/40 hover:shadow-md",
        className,
      )}
    >
      <div className="absolute right-3 top-3 z-10">{cornerAction}</div>
      <MarketingLinkCard
        href={href}
        aria-label={ariaLabel}
        className="flex flex-1 flex-col overflow-hidden rounded-t-xl"
      >
        <div className="relative aspect-[4/5] bg-surface-container-low">
          {portrait}
          <div className="pointer-events-none absolute left-3 top-3 z-[1] flex flex-wrap gap-1">
            {badges}
          </div>
        </div>
        <div className="flex flex-1 flex-col gap-1 p-3 md:p-4">
          {title}
          {meta}
          {bio}
        </div>
      </MarketingLinkCard>
      <div className="flex items-center justify-between gap-2 border-t border-outline-variant/15 px-3 py-2 md:gap-3 md:px-4 md:py-3">
        {footer}
      </div>
    </li>
  );
}
