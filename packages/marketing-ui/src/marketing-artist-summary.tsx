import { FOCUS_RING } from "@auction/branding";
import { cn } from "@auction/ui";
import Link from "next/link";
import { type ReactNode, useId } from "react";
import { MarketingReadMore } from "./marketing-read-more.js";

export type MarketingArtistSummaryProps = {
  /** Section heading, e.g. "About the artist". */
  title: string;
  name: string;
  href: string;
  /** Portrait rendered inside the 48px round frame; initials are shown when omitted. */
  avatar?: ReactNode;
  /** Trailing control, typically a Follow button. */
  action?: ReactNode;
  bio?: string | null;
  className?: string;
};

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

/** Artist card for detail pages: avatar, linked name, an action slot and a clamped bio. */
export function MarketingArtistSummary({
  title,
  name,
  href,
  avatar,
  action,
  bio,
  className,
}: MarketingArtistSummaryProps) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className={cn("flex flex-col gap-4", className)}>
      <h2 id={headingId} className="text-lg font-medium text-on-surface">
        {title}
      </h2>
      <div className="flex items-center gap-4">
        <span
          aria-hidden
          className="relative flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-container font-label text-sm font-semibold text-on-surface-variant"
        >
          {avatar ?? initials(name)}
        </span>
        <Link
          href={href}
          className={cn(
            "min-w-0 flex-1 truncate rounded-sm text-base font-semibold text-on-surface hover:underline",
            FOCUS_RING,
          )}
        >
          {name}
        </Link>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {bio ? (
        <MarketingReadMore>
          <p className="whitespace-pre-line text-sm leading-6 text-on-surface-variant">{bio}</p>
        </MarketingReadMore>
      ) : null}
    </section>
  );
}
