import { StatusBadge } from "./status-badge.js";
import type { StatusBadgeProps } from "./status-badge.js";

export type LiveBadgeProps = {
  className?: string;
  label?: string;
  size?: StatusBadgeProps["size"];
};

/** Live / time-critical status pill with pulse dot — canonical ring style via StatusBadge. */
export function LiveBadge({ className, label = "Live", size = "sm" }: LiveBadgeProps) {
  return (
    <StatusBadge variant="live" size={size} dot className={className}>
      {label}
    </StatusBadge>
  );
}
