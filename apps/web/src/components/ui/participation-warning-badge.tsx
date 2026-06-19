import {
  type LotParticipationWarningKind,
  lotParticipationWarningPresentation,
} from "@/lib/presenters/participation-warning-presentation";
import { StatusBadge } from "@auction/ui";
import type { ComponentProps } from "react";

export type ParticipationWarningBadgeProps = {
  kind: LotParticipationWarningKind;
  extendedSeconds?: number;
  size?: ComponentProps<typeof StatusBadge>["size"];
  className?: string;
};

/** Participation / bid-flow warning → StatusBadge warning variant. */
export function ParticipationWarningBadge({
  kind,
  extendedSeconds,
  size = "sm",
  className,
}: ParticipationWarningBadgeProps) {
  const presentation = lotParticipationWarningPresentation(
    kind,
    extendedSeconds !== undefined ? { extendedSeconds } : undefined,
  );
  return (
    <StatusBadge variant={presentation.variant} size={size} className={className}>
      {presentation.label}
    </StatusBadge>
  );
}
