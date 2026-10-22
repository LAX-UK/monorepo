import { FOCUS_RING } from "@auction/branding";
import { cn } from "@auction/ui";
import Link from "next/link";
import type { ReactNode } from "react";

export type MarketingFollowRowProps = {
  name: string;
  href: string;
  /** Round portrait frame content; initials are shown when omitted. */
  avatar?: ReactNode;
  /** Nationality and years, or any short descriptor under the name. */
  caption?: string | null;
  /** Trailing control, typically the Following toggle. */
  action?: ReactNode;
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

/** One followed artist on a single line: avatar, linked name, caption and an action (Figma 867:15613). */
export function MarketingFollowRow({
  name,
  href,
  avatar,
  caption,
  action,
  className,
}: MarketingFollowRowProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-4 border-b border-border-hairline py-4 last:border-b-0",
        className,
      )}
    >
      <span
        aria-hidden
        className="relative flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-container font-label text-base font-semibold text-on-surface-variant md:size-16"
      >
        {avatar ?? initials(name)}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <Link
          href={href}
          className={cn(
            "w-fit max-w-full truncate rounded-sm font-headline text-base font-medium text-on-surface hover:underline md:text-xl",
            FOCUS_RING,
          )}
        >
          {name}
        </Link>
        {caption ? (
          <p className="truncate text-sm text-on-surface-variant md:text-base">{caption}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
