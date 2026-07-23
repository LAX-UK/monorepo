"use client";

import type { StatusPresentationContext } from "@/lib/presenters/status/core";
import {
  type AdminStatusDomain,
  resolveDotStatusPresentation,
} from "@/lib/presenters/status/resolver";
import { DotStatusPill } from "@auction/ui/components/dot-status-pill";

export type StatusChipProps = {
  domain: AdminStatusDomain;
  status: string;
  context?: StatusPresentationContext;
  label?: string;
  className?: string;
};

/** Domain status → registry → Tag-Review chip. */
export function StatusChip({ domain, status, context, label, className }: StatusChipProps) {
  const presentation = resolveDotStatusPresentation(domain, status, context);
  return (
    <DotStatusPill
      label={label ?? presentation.label}
      tone={presentation.tone}
      {...(className ? { className } : {})}
    />
  );
}
