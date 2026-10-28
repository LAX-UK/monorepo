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
  /** Media for the thumb; fill the slot (`absolute inset-0 size-full`). */
  image: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  /** Top-right controls (favourite, badges). */
  trailing?: ReactNode;
  /** Price / status / actions line. */
  footer?: ReactNode;
  /**
   * Gallery column (price, save, enquire). It stacks under the title on small screens and becomes
   * a divided right-hand column from `md`, so controls that only belong on desktop use `md:` utilities.
   */
  aside?: ReactNode;
  /** `md`: Bid's square thumb. `lg`: large landscape media for gallery lists (Art `881:21543`). */
  size?: "md" | "lg";
  className?: string;
  "data-testid"?: string;
};

const ROW_SIZE = {
  md: {
    article: "rounded-lg p-4 sm:gap-5 sm:p-5",
    media: "size-20 rounded-lg sm:size-24",
    body: "",
    title: "text-base sm:text-lg",
    subtitle: "mt-1 text-xs sm:text-sm",
  },
  lg: {
    article: "py-4 md:gap-6 md:py-6 md:pr-6",
    media: "size-20 md:aspect-[4/3] md:size-auto md:w-48 lg:w-[16.25rem]",
    body: "md:justify-center",
    title: "flex min-h-6 items-center text-sm md:text-xl md:leading-7",
    subtitle: "mt-1 text-xs md:mt-1.5 md:text-base",
  },
} as const;

/**
 * Bid `LotCardList` row: thumb, title block, trailing controls, footer line and an optional aside
 * column. The whole row is clickable; nested links and buttons stay independently focusable.
 */
export function MarketingCatalogListRow({
  href,
  linkLabel,
  image,
  title,
  subtitle,
  trailing,
  footer,
  aside,
  size = "md",
  className,
  "data-testid": testId,
}: MarketingCatalogListRowProps) {
  const classes = ROW_SIZE[size];
  return (
    <li>
      <article
        className={cn(
          "group relative flex gap-4 transition-colors hover:bg-surface-container-low/50",
          classes.article,
          FOCUS_WITHIN_RING,
          className,
        )}
        data-testid={testId}
        data-size={size}
      >
        <Link href={href} className="absolute inset-0 z-0" aria-hidden="true" tabIndex={-1} />
        <span
          className={cn(
            "pointer-events-none relative z-[1] shrink-0 overflow-hidden bg-surface-container-low",
            classes.media,
          )}
        >
          {image}
        </span>
        <div className="pointer-events-none relative z-[1] flex min-w-0 flex-1 flex-col gap-3 md:flex-row md:gap-6 [&_a]:pointer-events-auto [&_button]:pointer-events-auto">
          <div className={cn("flex min-w-0 flex-1 flex-col", classes.body)}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <Link
                  href={href}
                  className={cn(
                    "block w-fit rounded-sm font-headline font-medium text-on-surface underline-offset-4 group-hover:underline focus-visible:outline-none",
                    classes.title,
                  )}
                  aria-label={linkLabel}
                >
                  {title}
                </Link>
                {subtitle ? (
                  <div className={cn("text-on-surface-variant", classes.subtitle)}>{subtitle}</div>
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
          {aside ? (
            <div
              className="relative z-[2] flex flex-col gap-4 md:w-60 md:shrink-0 md:justify-between md:border-l md:border-outline-variant md:py-6 md:pl-6 lg:w-[18.75rem]"
              data-testid="marketing-catalog-list-row-aside"
            >
              {aside}
            </div>
          ) : null}
        </div>
      </article>
    </li>
  );
}
