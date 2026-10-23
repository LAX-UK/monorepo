import type { AtgRemoteStatus } from "@auction/types";
import { StatusBadge, type StatusBadgeProps } from "@auction/ui/components/status-badge";

const LABELS: Record<AtgRemoteStatus, string> = {
  pending: "Pending",
  created: "On ATG (draft)",
  approved: "Approved",
  published: "Published",
  closed: "Closed",
};

const VARIANTS: Record<AtgRemoteStatus, StatusBadgeProps["variant"]> = {
  pending: "neutral",
  created: "info",
  approved: "info",
  published: "success",
  closed: "neutral",
};

export function AtgStatusBadge({ status }: { status: AtgRemoteStatus | null }) {
  if (!status) return <StatusBadge variant="neutral">Not on ATG</StatusBadge>;
  return <StatusBadge variant={VARIANTS[status]}>{LABELS[status]}</StatusBadge>;
}
