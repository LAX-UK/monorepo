"use client";

import { FOCUS_RING } from "@auction/branding";
import { cn } from "@auction/ui";
import { type ReactNode, useId, useState } from "react";
import { useMediaQuery } from "./hooks/use-media-query.js";
import { MarketingChevronDownIcon } from "./marketing-icons.js";

/** Below the footer's two-column layout: one column, so each section folds away. */
const PHONE_QUERY = "(max-width: 639.98px)";

export const FOOTER_HEADING_CLASS =
  "marketing-footer__heading font-label text-sm font-semibold text-on-surface";

export type MarketingFooterSectionProps = {
  /** Id of the heading element, referenced by the section's `aria-labelledby`. */
  headingId: string;
  title: string;
  /** The section's links, rendered by the footer so product link components stay on the server. */
  children: ReactNode;
  className?: string;
};

/**
 * One footer column. On a phone it is a disclosure that starts closed, so a long Legal list does
 * not stretch the page; everywhere else, and before scripts run, the links are simply shown.
 */
export function MarketingFooterSection({
  headingId,
  title,
  children,
  className,
}: MarketingFooterSectionProps) {
  const panelId = useId();
  const isPhone = useMediaQuery(PHONE_QUERY);
  const [open, setOpen] = useState(false);

  if (!isPhone) {
    return (
      <nav aria-labelledby={headingId} className={className}>
        <h3 id={headingId} className={FOOTER_HEADING_CLASS}>
          {title}
        </h3>
        <div className="mt-4">{children}</div>
      </nav>
    );
  }

  return (
    <nav
      aria-labelledby={headingId}
      className={cn("border-b border-border-hairline first:border-t", className)}
    >
      <h3 id={headingId} className="m-0">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((value) => !value)}
          className={cn(
            FOOTER_HEADING_CLASS,
            "group flex min-h-12 w-full items-center justify-between gap-3 rounded-sm text-left transition-colors hover:text-link",
            FOCUS_RING,
          )}
        >
          {title}
          <MarketingChevronDownIcon
            aria-hidden
            className={cn(
              "shrink-0 transition-transform duration-200 motion-reduce:transition-none",
              open && "rotate-180",
            )}
          />
        </button>
      </h3>
      <div id={panelId} hidden={!open} className="pb-4">
        {children}
      </div>
    </nav>
  );
}
