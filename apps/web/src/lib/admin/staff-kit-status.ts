import type { StatusBadgeVariant } from "@/lib/presenters/status-presentation";
import type { StatusPresentation } from "@auction/staff-ui";

/**
 * Bid's status registries (lib/presenters/status) speak in badge variants; the staff kit speaks
 * in tones. "live" is the danger tone with a pulsing dot, so live lots and sales still read as
 * happening now. One adapter keeps the registries the single source of each label and tone.
 */
export function toStaffStatus(variant: StatusBadgeVariant, label: string): StatusPresentation {
  if (variant === "live") return { label, tone: "danger", live: true };
  return { label, tone: variant };
}
