"use client";

import type { AtgSellingBadge } from "@auction/types";
import { StatusBadge } from "@auction/ui/components/status-badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@auction/ui/components/tooltip";
import Link from "next/link";
import { useId } from "react";

const TRIGGER_CLASS =
  "inline-flex rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

type Props = {
  badge: AtgSellingBadge;
  /** The sale's ATG tab; ATG badges link there, lax.bid badges do not. */
  atgHref?: string | null;
};

/**
 * Where a sale or lot sells, next to its status badge. The label and explanation come from the
 * shared ownership helpers in `@auction/types`, so they match the server guards.
 */
export function SellingPlatformBadge({ badge, atgHref = null }: Props) {
  const descriptionId = useId();
  const chip = (
    <StatusBadge variant={badge.platform === "atg" ? "info" : "neutral"} size="sm">
      {badge.label}
    </StatusBadge>
  );
  const href = badge.platform === "atg" ? atgHref : null;
  return (
    <span className="inline-flex" data-selling-platform={badge.platform}>
      <Tooltip>
        <TooltipTrigger asChild>
          {href ? (
            <Link href={href} className={TRIGGER_CLASS} aria-describedby={descriptionId}>
              {chip}
            </Link>
          ) : (
            // biome-ignore lint/a11y/noNoninteractiveTabindex: focusable so keyboard users get the tooltip
            <span tabIndex={0} className={TRIGGER_CLASS} aria-describedby={descriptionId}>
              {chip}
            </span>
          )}
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">{badge.description}</TooltipContent>
      </Tooltip>
      <span id={descriptionId} className="sr-only">
        {badge.description}
      </span>
    </span>
  );
}

/** Compact list-row marker for sales and lots linked to or selling on ATG. */
export function AtgListMarker({ label = "Linked to ATG" }: { label?: string }) {
  return (
    <StatusBadge variant="info" size="sm" title={label} data-atg-marker="">
      <span aria-hidden>ATG</span>
      <span className="sr-only">{label}</span>
    </StatusBadge>
  );
}
