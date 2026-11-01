import type { StatusPresentation } from "@/lib/presenters/status-presentation";
import type { StatusBadgeShape, StatusBadgeTone } from "@auction/ui";

export type PublicStatusBadgeProps = {
  tone: StatusBadgeTone;
  shape?: StatusBadgeShape;
  live?: boolean;
};

/**
 * How a status draws on the public site. Something happening now is the neutral badge with the
 * pulsing live dot, never a solid red block: red is kept for outbid and overdue. Every other
 * status keeps its registry tone.
 */
export function toPublicStatusBadgeProps(presentation: StatusPresentation): PublicStatusBadgeProps {
  if (presentation.variant === "live") return { tone: "neutral", live: true };
  return {
    tone: presentation.variant,
    ...(presentation.dot ? { shape: "dot" as const } : {}),
  };
}
