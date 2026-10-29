import { StatusBadge } from "./status-badge.js";

export type LiveBadgeProps = {
  className?: string;
  label?: string;
};

/** Something happening now: the live tone with its pulsing dot. */
export function LiveBadge({ className, label = "Live" }: LiveBadgeProps) {
  return (
    <StatusBadge variant="live" shape="dot" className={className}>
      {label}
    </StatusBadge>
  );
}
