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
  return (
    <StatusBadge
      tone={presentation.variant}
      {...(presentation.dot ? { shape: "dot" as const } : {})}
      className={className}
    >
      {presentation.label}
    </StatusBadge>
  );
}
