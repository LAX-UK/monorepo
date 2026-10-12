import { FOCUS_WITHIN_RING, MARKETING_CATALOG_LIST_SHELL } from "@auction/branding";
import { cn } from "@auction/ui";
import Link from "next/link";
import type { ReactNode } from "react";

export type MarketingCatalogListProps = {
  children: ReactNode;
  className?: string;
  "aria-label"?: string | undefined;
  "data-testid"?: string | undefined;
};

/** Bid's catalogue list shell: hairline-bordered panel with divided rows. */
export function MarketingCatalogList({
  children,
  className,
  "aria-label": ariaLabel,
  "data-testid": testId,
}: MarketingCatalogListProps) {
  return (
    <div className={cn(MARKETING_CATALOG_LIST_SHELL, "w-full", className)}>
      <ul
        className="divide-y divide-outline-variant/15 sm:rounded-xl"
        aria-label={ariaLabel}
        data-testid={testId}
      >
        {children}
      </ul>
    </div>
  );
}

export type MarketingCatalogListRowProps = {
  href: string;
  /** Accessible name for the whole-row link (usually the title). */
  linkLabel: string;
  /** Media for the square thumb; fill the slot (`absolute inset-0 size-full`). */
  image: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  /** Top-right controls (favourite, badges). */
  trailing?: ReactNode;
  /** Price / status / actions line. */
  footer?: ReactNode;
  className?: string;
  "data-testid"?: string;
};

/**
 * Bid `LotCardList` row: square thumb, title block, trailing controls and footer line. The whole
 * row is clickable; nested links and buttons stay independently focusable.
 */
export function MarketingCatalogListRow({
  href,
  linkLabel,
  image,
  title,
  subtitle,
  trailing,
  footer,
  className,
  "data-testid": testId,
}: MarketingCatalogListRowProps) {
  return (
    <li>
      <article
        className={cn(
          "group relative flex gap-4 rounded-lg p-4 transition-colors hover:bg-surface-container-low/50 sm:gap-5 sm:p-5",
          FOCUS_WITHIN_RING,
          className,
        )}
        data-testid={testId}
      >
        <Link href={href} className="absolute inset-0 z-0" aria-hidden="true" tabIndex={-1} />
        <span className="pointer-events-none relative z-[1] size-20 shrink-0 overflow-hidden rounded-lg bg-surface-container-low sm:size-24">
          {image}
        </span>
        <div className="pointer-events-none relative z-[1] flex min-w-0 flex-1 flex-col [&_a]:pointer-events-auto [&_button]:pointer-events-auto">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <Link
                href={href}
                className="block w-fit rounded-sm font-headline text-base font-medium text-on-surface underline-offset-4 group-hover:underline focus-visible:outline-none sm:text-lg"
                aria-label={linkLabel}
              >
                {title}
              </Link>
              {subtitle ? (
                <div className="mt-1 text-xs text-on-surface-variant sm:text-sm">{subtitle}</div>
              ) : null}
            </div>
            {trailing ? <div className="relative z-[2] shrink-0">{trailing}</div> : null}
          </div>
          {footer ? (
            <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-3">
              {footer}
            </div>
          ) : null}
        </div>
      </article>
    </li>
  );
}
