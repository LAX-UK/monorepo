import { StatusChip, type StatusChipProps } from "@/components/ui/status-chip";
import { DotStatusPill } from "@auction/ui/components/dot-status-pill";

export type AdminStatusBadgeProps = StatusChipProps & {
  /** @deprecated Tag-Review chips use a single size; ignored. */
  size?: "sm" | "md";
};

/** Single staff status chip — maps domain status → Tag-Review pill. */
export function AdminStatusBadge({ size: _size, ...props }: AdminStatusBadgeProps) {
  return <StatusChip {...props} />;
}

/** Tab/queue count chip (not a domain status). */
export function AdminQueueCountBadge({
  count,
  className,
}: {
  count: number;
  className?: string;
}) {
  return (
    <DotStatusPill label={String(count)} tone="warning" {...(className ? { className } : {})} />
  );
}
