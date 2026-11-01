import { StatusBadge } from "./status-badge.js";

export type LiveBadgeProps = {
  className?: string;
  label?: string;
};

/**
 * Something happening now: the neutral badge with the pulsing live dot. Live is a state, not an
 * alarm, so it is never a solid red block; red stays for outbid and overdue.
 */
export function LiveBadge({ className, label = "Live" }: LiveBadgeProps) {
  return (
    <StatusBadge tone="neutral" live className={className}>
      {label}
    </StatusBadge>
  );
}
