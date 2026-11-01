"use client";

import type { LifecycleBadgeVM } from "@/lib/lot/lot-lifecycle";
import { lifecycleToStatusPresentation } from "@/lib/presenters/lifecycle-status-presentation";
import { toPublicStatusBadgeProps } from "@/lib/presenters/public-status-badge";
import { StatusBadge } from "@auction/ui";

export type LotLifecycleStatusBadgeProps = {
  badge: LifecycleBadgeVM;
  className?: string;
};

/** Lifecycle badge VM → registry tone → the public status badge. */
export function LotLifecycleStatusBadge({ badge, className }: LotLifecycleStatusBadgeProps) {
  const presentation = lifecycleToStatusPresentation(badge);
  return (
    <StatusBadge {...toPublicStatusBadgeProps(presentation)} className={className}>
      {presentation.label}
    </StatusBadge>
  );
}
