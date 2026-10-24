import type { StatusBadgeVariant } from "@/lib/presenters/status-presentation";
import { resolveStatusPresentation } from "@/lib/presenters/status-presentation";
import type { StatusDomain } from "@/lib/presenters/status/core";
import { type StatusPresentation, humanizeStatus } from "@auction/staff-ui";

/**
 * Bid's status registries (lib/presenters/status) speak in badge variants; the staff kit speaks
 * in tones. "live" is the danger tone with a pulsing dot, so live lots and sales still read as
 * happening now. One adapter keeps the registries the single source of each label and tone.
 */
export function toStaffStatus(variant: StatusBadgeVariant, label: string): StatusPresentation {
  if (variant === "live") return { label, tone: "danger", live: true };
  return { label, tone: variant };
}

/**
 * Every Bid status family on the kit's five tones (neutral, info, success, warning, danger), from
 * the one registry, so a payment, payout, dispute, AML or source-of-funds status looks the same
 * on every page and in both staff tools. A status the registry does not know yet still renders,
 * as its name in sentence case in the neutral tone.
 */
export function staffStatus(domain: StatusDomain, status: string): StatusPresentation {
  const presentation = resolveStatusPresentation(domain, status);
  // The registry falls back to the raw value ("pending_refund_period" or "pending refund period").
  const raw = /^[a-z]/.test(presentation.label) || presentation.label.includes("_");
  const label = raw ? humanizeStatus(status) : presentation.label;
  return toStaffStatus(presentation.variant, label);
}
