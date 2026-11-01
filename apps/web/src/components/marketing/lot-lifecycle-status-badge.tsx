"use client";

import type { LifecycleBadgeVM } from "@/lib/lot/lot-lifecycle";
import { lifecycleToStatusPresentation } from "@/lib/presenters/lifecycle-status-presentation";
import { StatusBadge } from "@auction/ui";

export type LotLifecycleStatusBadgeProps = {
  badge: LifecycleBadgeVM;
  className?: string;
};

/** Lifecycle badge VM → registry variant → StatusBadge. */
export function LotLifecycleStatusBadge({ badge, className }: LotLifecycleStatusBadgeProps) {
  const presentation = lifecycleToStatusPresentation(badge);
  const pill = (
    <StatusBadge
      tone={presentation.variant}
      {...(presentation.dot ? { shape: "dot" as const } : {})}
      className={className}
    >
      {presentation.label}
    </StatusBadge>
  );
  if (!badge.href) return pill;
  return (
    <a
      href={badge.href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-link"
    >
      {pill}
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}
