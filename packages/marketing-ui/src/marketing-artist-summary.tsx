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
  /** Trailing control beside the name, typically a Follow button. */
  action?: ReactNode;
  /** Links or buttons under the bio, e.g. "Editions by …" and a profile link. */
  actions?: ReactNode;
  bio?: string | null;
  /** One line under the name, e.g. "British · b. 1956 · Printmaker". */
  meta?: string | null;
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

/**
 * Artist card for detail pages: avatar, linked name, an action beside the name, a clamped bio
 * and a row of actions under it.
 */
export function MarketingArtistSummary({
  title,
  name,
  href,
  avatar,
  action,
  actions,
  bio,
  meta,
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
        <div className="flex min-w-0 flex-1 flex-col">
          <Link
            href={href}
            className={cn(
              "w-fit max-w-full truncate rounded-sm text-base font-semibold text-on-surface hover:underline",
              FOCUS_RING,
            )}
          >
            {name}
          </Link>
          {meta ? <p className="m-0 text-sm leading-5 text-on-surface-variant">{meta}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {bio ? (
        <MarketingReadMore>
          <p className="whitespace-pre-line text-sm leading-6 text-on-surface-variant">{bio}</p>
        </MarketingReadMore>
      ) : null}
      {actions ? (
        <div
          data-slot="artist-summary-actions"
          className="flex flex-wrap items-center gap-x-5 gap-y-3"
        >
          {actions}
        </div>
      ) : null}
    </section>
  );
}
