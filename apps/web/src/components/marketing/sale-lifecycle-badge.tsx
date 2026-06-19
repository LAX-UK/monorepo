import { resolveStatusPresentation } from "@/lib/presenters/status-presentation";
import type { SaleStatus } from "@auction/types";
import { StatusBadge } from "@auction/ui";
import type { ComponentProps } from "react";

export type SaleLifecycleBadgeProps = {
  status: SaleStatus | string;
  /** Override registry label. */
  label?: string | undefined;
  size?: ComponentProps<typeof StatusBadge>["size"];
  className?: string;
};

/** Sale API status → registry label + variant → StatusBadge. */
export function SaleLifecycleBadge({
  status,
  label,
  size = "sm",
  className,
}: SaleLifecycleBadgeProps) {
  const presentation = resolveStatusPresentation("sale", status);
  return (
    <StatusBadge
      variant={presentation.variant}
      size={size}
      {...(presentation.dot ? { dot: true } : {})}
      className={className}
    >
      {label ?? presentation.label}
    </StatusBadge>
  );
}
