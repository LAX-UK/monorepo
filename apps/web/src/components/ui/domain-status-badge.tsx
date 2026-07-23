import {
  type StatusDomain,
  type StatusPresentationContext,
  resolveDotStatusPresentation,
} from "@/lib/presenters/status/resolver";
import { DotStatusPill } from "@auction/ui/components/dot-status-pill";

export type DomainStatusBadgeProps = {
  domain: StatusDomain;
  status: string;
  context?: StatusPresentationContext;
  /** Override auto label from registry. */
  label?: string;
  /** @deprecated Tag-Review chips use a single size; ignored. */
  size?: "sm" | "md";
  className?: string;
};

/** API status → registry label + variant → Tag-Review chip. */
export function DomainStatusBadge({
  domain,
  status,
  context,
  label,
  size: _size,
  className,
}: DomainStatusBadgeProps) {
  const presentation = resolveDotStatusPresentation(domain, status, context);
  return (
    <DotStatusPill
      label={label ?? presentation.label}
      tone={presentation.tone}
      {...(className ? { className } : {})}
    />
  );
}
