import {
  type AdminStatusDomain,
  adminStatusLabel,
  adminStatusToBadgeVariant,
} from "@/lib/admin/status-badge-variants";
import { StatusBadge } from "@auction/ui";
import type { ComponentProps } from "react";

export type AdminStatusBadgeProps = {
  domain: AdminStatusDomain;
  status: string;
  /** Override auto label from taxonomy */
  label?: string;
  size?: ComponentProps<typeof StatusBadge>["size"];
  className?: string;
};

/** Tab/queue count chip (not a domain status). */
export function AdminQueueCountBadge({
  count,
  size = "sm",
  className,
}: {
  count: number;
  size?: ComponentProps<typeof StatusBadge>["size"];
  className?: string;
}) {
  return (
    <StatusBadge variant="warning" size={size} className={className}>
      {count}
    </StatusBadge>
  );
}

/** Single staff status chip — maps domain status → StatusBadge variant + label. */
export function AdminStatusBadge({
  domain,
  status,
  label,
  size = "sm",
  className,
}: AdminStatusBadgeProps) {
  const variant = adminStatusToBadgeVariant(domain, status);
  const text = label ?? adminStatusLabel(domain, status);
  return (
    <StatusBadge variant={variant} size={size} dot={variant === "live"} className={className}>
      {text}
    </StatusBadge>
  );
}
