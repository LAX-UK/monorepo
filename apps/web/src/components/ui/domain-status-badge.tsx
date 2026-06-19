import {
  type StatusDomain,
  type StatusPresentationContext,
  resolveStatusPresentation,
} from "@/lib/presenters/status-presentation";
import { StatusBadge } from "@auction/ui";
import type { ComponentProps } from "react";

export type DomainStatusBadgeProps = {
  domain: StatusDomain;
  status: string;
  context?: StatusPresentationContext;
  /** Override auto label from registry. */
  label?: string;
  size?: ComponentProps<typeof StatusBadge>["size"];
  className?: string;
};

/** API status → registry label + variant → StatusBadge. */
export function DomainStatusBadge({
  domain,
  status,
  context,
  label,
  size = "sm",
  className,
}: DomainStatusBadgeProps) {
  const presentation = resolveStatusPresentation(domain, status, context);
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
