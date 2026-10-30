import {
  type LotParticipationWarningKind,
  lotParticipationWarningPresentation,
} from "@/lib/presenters/participation-warning-presentation";
import { StatusBadge } from "@auction/ui";

export type ParticipationWarningBadgeProps = {
  kind: LotParticipationWarningKind;
  extendedSeconds?: number;
  className?: string;
};

/** Participation / bid-flow warning → StatusBadge warning variant. */
export function ParticipationWarningBadge({
  kind,
  extendedSeconds,
  className,
}: ParticipationWarningBadgeProps) {
  const presentation = lotParticipationWarningPresentation(
    kind,
    extendedSeconds !== undefined ? { extendedSeconds } : undefined,
  );
  return (
    <StatusBadge tone={presentation.variant} className={className}>
      {presentation.label}
    </StatusBadge>
  );
}
