import { resolveStatusPresentation } from "@/lib/presenters/status-presentation";
import type { SaleStatus } from "@auction/types";
import { StatusBadge } from "@auction/ui";

export type SaleLifecycleBadgeProps = {
  status: SaleStatus | string;
  /** Override registry label. */
  label?: string | undefined;
  className?: string;
};

/** Sale API status → registry label + variant → StatusBadge. */
export function SaleLifecycleBadge({ status, label, className }: SaleLifecycleBadgeProps) {
  const presentation = resolveStatusPresentation("sale", status);
  return (
    <StatusBadge
      tone={presentation.variant}
      {...(presentation.dot ? { shape: "dot" as const } : {})}
      className={className}
    >
      {label ?? presentation.label}
    </StatusBadge>
  );
}
