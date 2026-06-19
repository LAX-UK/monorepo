"use client";

import type { LifecycleBadgeVM } from "@/lib/lot/lot-lifecycle";
import { lifecycleToStatusPresentation } from "@/lib/presenters/lifecycle-status-presentation";
import { StatusBadge } from "@auction/ui";
import type { ComponentProps } from "react";

export type LotLifecycleStatusBadgeProps = {
  badge: LifecycleBadgeVM;
  size?: ComponentProps<typeof StatusBadge>["size"];
  className?: string;
};

/** Lifecycle badge VM → registry variant → StatusBadge. */
export function LotLifecycleStatusBadge({
  badge,
  size = "sm",
  className,
}: LotLifecycleStatusBadgeProps) {
  const presentation = lifecycleToStatusPresentation(badge);
  return (
    <StatusBadge
      variant={presentation.variant}
      size={size}
      {...(presentation.dot ? { dot: true } : {})}
      className={className}
    >
      {presentation.label}
    </StatusBadge>
  );
}
