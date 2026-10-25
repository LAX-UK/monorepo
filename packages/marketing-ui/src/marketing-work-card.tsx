import { FOCUS_RING } from "@auction/branding";
import { cn } from "@auction/ui";
import Link from "next/link";
import { Children, type ReactNode, isValidElement } from "react";
import { MarketingCardMedia } from "./marketing-card-media.js";
import { MarketingCardReveal } from "./motion/index.js";

export type MarketingWorkCardProps = {
  href: string;
  title: string;
  /** h2 on a listing page, h3 inside a titled section. */
  titleAs?: "h2" | "h3";
  /**
   * Image filling the mat (absolutely positioned). It is shown whole with `object-contain`, so
   * a work is never cropped; the mat shows around it.
   */
  media: ReactNode;
  /** Badge over the top-left of the mat, e.g. "Yours". */
  mediaBadge?: ReactNode;
  /** Status over the bottom-left of the mat, e.g. a lot status. */
  mediaStatus?: ReactNode;
  /** Control beside the title, e.g. a save heart. */
  action?: ReactNode;
  /** Line under the title, e.g. the artist link. */
  subtitle?: ReactNode;
  /** Supporting lines: year and medium, size, estimate. */
  details?: ReactNode;
  /** Price or result, pinned to the bottom of the card. */
  footer?: ReactNode;
  className?: string;
  "data-testid"?: string;
};

/** Artwork card shared by lots (Bid), editions (Shop) and originals (lax.art). */
export function MarketingWorkCard({
  href,
  title,
  titleAs: Title = "h3",
  media,
  mediaBadge,
  mediaStatus,
  action,
  subtitle,
  details,
  footer,
  className,
  "data-testid": testId = "marketing-work-card",
}: MarketingWorkCardProps) {
  return (
    <article
      className={cn("group relative flex h-full min-w-0 flex-col", className)}
      data-testid={testId}
    >
      <MarketingCardMedia className="aspect-[4/5] bg-surface-container-low">
        <Link href={href} tabIndex={-1} aria-hidden className="absolute inset-0 block p-[7%]">
          <span className="relative block size-full [&_img]:!object-contain">{media}</span>
        </Link>
        {mediaBadge ? (
          <div className="pointer-events-none absolute left-2 top-2 z-[1]">{mediaBadge}</div>
        ) : null}
        {mediaStatus ? (
          <div className="pointer-events-none absolute bottom-2 left-2 z-[1] max-w-[calc(100%-1rem)]">
            {mediaStatus}
          </div>
        ) : null}
      </MarketingCardMedia>
      <div className="flex min-w-0 flex-1 flex-col pt-3 md:pt-4">
        <div className="flex items-start gap-2">
          <Title className="line-clamp-2 min-w-0 flex-1 font-headline text-base font-medium leading-6 text-on-surface">
            <Link
              href={href}
              className={cn("rounded-sm underline-offset-4 hover:underline", FOCUS_RING)}
            >
              {title}
            </Link>
          </Title>
          {action ? <div className="-mr-2 -mt-2 shrink-0">{action}</div> : null}
        </div>
        {subtitle ? (
          <div className="mt-1 min-w-0 font-body text-sm leading-5 text-on-surface-variant">
            {subtitle}
          </div>
        ) : null}
        {details ? (
          <div className="mt-1 flex min-w-0 flex-col gap-0.5 font-body text-sm leading-5 text-on-surface-variant">
            {details}
          </div>
        ) : null}
        {footer ? (
          <div className="mt-auto flex min-w-0 flex-col items-start gap-1 pt-3 font-body text-sm font-medium leading-5 text-on-surface">
            {footer}
          </div>
        ) : null}
      </div>
    </article>
  );
}

export const MARKETING_WORK_GRID_CLASS =
  "grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 lg:gap-x-6 xl:grid-cols-4";

export type MarketingWorkGridProps = {
  children: ReactNode;
  "aria-label"?: string;
  className?: string;
  "data-testid"?: string;
};

/** Responsive works grid: two columns on phones, up to four on wide screens. */
export function MarketingWorkGrid({
  children,
  "aria-label": ariaLabel,
  className,
  "data-testid": testId,
}: MarketingWorkGridProps) {
  return (
    <ul
      className={cn(MARKETING_WORK_GRID_CLASS, className)}
      aria-label={ariaLabel}
      data-testid={testId}
    >
      {Children.toArray(children).map((child, index) => (
        <li
          key={isValidElement(child) && child.key != null ? child.key : index}
          className="min-w-0"
        >
          <MarketingCardReveal index={index}>{child}</MarketingCardReveal>
        </li>
      ))}
    </ul>
  );
}
