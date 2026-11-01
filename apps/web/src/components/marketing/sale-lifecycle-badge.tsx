import { toPublicStatusBadgeProps } from "@/lib/presenters/public-status-badge";
import { resolveStatusPresentation } from "@/lib/presenters/status-presentation";
import { opensBadgeLabel } from "@/lib/time/opens-line";
import type { SaleStatus } from "@auction/types";
import { StatusBadge } from "@auction/ui";

export type SaleLifecycleBadgeProps = {
  status: SaleStatus | string;
  /** Override registry label. */
  label?: string | undefined;
  /** When a scheduled sale opens: the badge then reads "Opens Tue 10 Nov". */
  opensAt?: Date | string | null | undefined;
  className?: string;
};

/**
 * Sale API status → registry label and tone → the public status badge. A sale that has not opened
 * is the neutral badge with the ring cue (not started), worded by when it opens.
 */
export function SaleLifecycleBadge({ status, label, opensAt, className }: SaleLifecycleBadgeProps) {
  const presentation = resolveStatusPresentation("sale", status);
  if (status === "scheduled") {
    const opens = opensAt ? new Date(opensAt) : null;
    const words =
      label ??
      (opens && !Number.isNaN(opens.getTime()) ? opensBadgeLabel(opens, new Date()) : "Upcoming");
    return (
      <StatusBadge tone="neutral" shape="ring" className={className}>
        {words}
      </StatusBadge>
    );
  }
  return (
    <StatusBadge {...toPublicStatusBadgeProps(presentation)} className={className}>
      {label ?? presentation.label}
    </StatusBadge>
  );
}
