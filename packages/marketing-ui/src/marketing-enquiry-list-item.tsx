import { FOCUS_RING } from "@auction/branding";
import { cn } from "@auction/ui";
import Link from "next/link";
import type { ReactNode } from "react";

export type MarketingEnquiryListItemProps = {
  /**
   * `default`: text row. `artwork`: leads with a thumbnail slot. `compact`: tighter padding for
   * mobile lists (Figma 872:17745).
   */
  variant?: "default" | "artwork" | "compact";
  /** Label above the title, e.g. "Artwork enquiry". */
  typeLabel: string;
  title: string;
  description?: string | null;
  /** Links the title when the enquiry has a destination. */
  href?: string | null;
  /** Thumbnail node for the `artwork` variant; the slot is dropped when omitted. */
  media?: ReactNode;
  /** Status pill. */
  status?: ReactNode;
  date: ReactNode;
  className?: string;
};

/** One row of the account enquiries list: type, title, status and date. */
export function MarketingEnquiryListItem({
  variant = "default",
  typeLabel,
  title,
  description,
  href,
  media,
  status,
  date,
  className,
}: MarketingEnquiryListItemProps) {
  return (
    <div
      data-variant={variant}
      className={cn(
        "flex gap-4 border-b border-border-hairline",
        variant === "compact" ? "py-3" : "py-5 md:py-6",
        className,
      )}
    >
      {variant === "artwork" && media ? (
        <div className="relative size-16 shrink-0 overflow-hidden bg-surface-container md:size-20">
          {media}
        </div>
      ) : null}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="text-sm text-on-surface-variant">{typeLabel}</p>
        <p className="font-headline text-base font-medium leading-6 text-on-surface md:text-xl md:leading-7">
          {href ? (
            <Link href={href} className={cn("rounded-sm hover:underline", FOCUS_RING)}>
              {title}
            </Link>
          ) : (
            title
          )}
        </p>
        {description ? (
          <p className="line-clamp-2 text-sm text-on-surface-variant">{description}</p>
        ) : null}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-2 text-sm text-on-surface-variant">
        {status}
        {date}
      </div>
    </div>
  );
}
