import { MarketingLinkCard } from "@/components/marketing/marketing-link-card";
import { MARKETING_CARD_MEDIA_HOVER } from "@/lib/marketing/chrome";
import { cn } from "@auction/ui";
import type { ReactNode } from "react";

export type ArtistCardGridDensity = "default" | "compact";

export type ArtistCardGridProps = {
  href: string;
  "aria-label": string;
  /** Watch / follow control overlaid on the portrait (bottom-right). */
  portraitOverlay: ReactNode;
  portrait: ReactNode;
  badges: ReactNode;
  title: ReactNode;
  meta: ReactNode;
  bio?: ReactNode;
  /** Row under the main link (e.g. “N lots” + “View profile”). */
  footer: ReactNode;
  className?: string;
  density?: ArtistCardGridDensity;
};

/** Directory `4/5` portrait tile — watch heart in `portraitOverlay`, badges top-left. */
export function ArtistCardGrid({
  href,
  "aria-label": ariaLabel,
  portraitOverlay,
  portrait,
  badges,
  title,
  meta,
  bio,
  footer,
  className,
  density = "default",
}: ArtistCardGridProps) {
  const isCompact = density === "compact";

  return (
    <li
      className={cn(
        "group relative flex flex-col overflow-hidden border border-border-hairline bg-surface transition-colors motion-reduce:transition-none hover:border-link/40",
        isCompact ? "rounded-lg" : "rounded-xl",
        className,
      )}
    >
      <MarketingLinkCard
        href={href}
        aria-label={ariaLabel}
        className={cn(
          "flex flex-1 flex-col overflow-hidden",
          isCompact ? "rounded-t-lg" : "rounded-t-xl",
        )}
      >
        <div
          className={cn(
            "relative aspect-[4/5] overflow-hidden bg-surface-container-low",
            MARKETING_CARD_MEDIA_HOVER,
          )}
        >
          {portrait}
          <div
            className={cn(
              "pointer-events-none absolute z-[1] flex flex-wrap gap-1",
              isCompact ? "left-2 top-2" : "left-3 top-3",
            )}
          >
            {badges}
          </div>
          <div
            className={cn(
              "pointer-events-auto absolute z-10",
              isCompact ? "bottom-2 right-2" : "bottom-3 right-3",
            )}
          >
            {portraitOverlay}
          </div>
        </div>
        <div
          className={cn("flex flex-1 flex-col gap-1", isCompact ? "p-2 md:p-2.5" : "p-3 md:p-4")}
        >
          {title}
          {meta}
          {bio}
        </div>
      </MarketingLinkCard>
      <div
        className={cn(
          "flex items-center justify-between gap-2 border-t border-border-hairline",
          isCompact ? "px-2 py-1.5 md:px-2.5" : "px-3 py-2 md:gap-3 md:px-4 md:py-3",
        )}
      >
        {footer}
      </div>
    </li>
  );
}
