import { cn } from "@auction/ui";
import type { ReactNode } from "react";
import { MarketingPlayIcon } from "./marketing-icons.js";

export type MarketingVideoPosterProps = {
  /** https URL of the hosted film; opens in a new tab (no third-party iframe on the page). */
  href: string;
  title: string;
  /** Poster image node (e.g. MediaImage); a neutral surface is shown when omitted. */
  poster?: ReactNode;
  watchLabel?: string;
  className?: string;
};

/** 16:9 poster with a centred play affordance linking out to the film. */
export function MarketingVideoPoster({
  href,
  title,
  poster,
  watchLabel = "Watch film",
  className,
}: MarketingVideoPosterProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${watchLabel}: ${title} (opens in a new tab)`}
      className={cn(
        "group relative block aspect-video overflow-hidden rounded-md bg-surface-container",
        "outline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring",
        className,
      )}
    >
      {poster ? (
        <div className="absolute inset-0 [&_img]:size-full [&_img]:object-cover">{poster}</div>
      ) : null}
      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent" />
      <span className="absolute inset-0 flex items-center justify-center">
        <span className="flex size-16 items-center justify-center rounded-full bg-surface/90 text-on-surface shadow-md transition-transform motion-safe:group-hover:scale-105">
          <MarketingPlayIcon className="ml-1 size-7" />
        </span>
      </span>
      <span className="absolute bottom-3 left-4 right-4 font-label text-xs text-white">
        {watchLabel}
      </span>
    </a>
  );
}
