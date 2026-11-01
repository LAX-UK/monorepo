import { FOCUS_RING } from "@auction/branding";
import { cn } from "@auction/ui";
import Link from "next/link";
import type { ComponentType, ReactNode } from "react";
import { MarketingArrowRightIcon } from "./marketing-icons.js";

type ListRowLinkProps = { href: string; className?: string; children: ReactNode };

export type MarketingEditorialListRowProps = {
  /** Publication or kind, shown small above the headline. */
  kicker?: string | null;
  title: string;
  /** Date line under the headline. */
  meta?: string | null;
  href: string;
  /** `inverse` for rows on a dark band; colours follow the surface the row sits on. */
  tone?: "default" | "inverse";
  /** Products route CMS links through their own safe-link component; defaults to `next/link`. */
  linkAs?: ComponentType<ListRowLinkProps>;
};

/**
 * Press and article list row with a trailing arrow (Figma exhibition Press, `743:20964`). The
 * headline link stretches over the whole row so it stays the only tab stop.
 */
export function MarketingEditorialListRow({
  kicker,
  title,
  meta,
  href,
  tone = "default",
  linkAs: LinkComponent = Link,
}: MarketingEditorialListRowProps) {
  const inverse = tone === "inverse";
  const secondary = inverse ? "opacity-80" : "text-on-surface-variant";
  return (
    <div
      className={cn(
        "group relative flex items-center gap-4 border-b py-5",
        inverse ? "border-current/30" : "border-outline-variant",
      )}
      data-tone={tone}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {kicker ? <p className={cn("m-0 font-label text-xs", secondary)}>{kicker}</p> : null}
        <p className="m-0 font-body text-base font-medium leading-6 md:text-lg">
          <LinkComponent
            href={href}
            className={cn(
              "rounded-sm underline-offset-4 after:absolute after:inset-0 group-hover:underline",
              FOCUS_RING,
            )}
          >
            {title}
          </LinkComponent>
        </p>
        {meta ? <p className={cn("m-0 text-sm", secondary)}>{meta}</p> : null}
      </div>
      <MarketingArrowRightIcon className="motion-safe:transition-transform motion-safe:duration-200 group-hover:translate-x-1" />
    </div>
  );
}
