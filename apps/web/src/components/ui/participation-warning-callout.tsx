import {
  type LotParticipationWarningKind,
  lotParticipationWarningPresentation,
  participationWarningCalloutBodyClassName,
  participationWarningCalloutClassName,
  participationWarningCalloutTitleClassName,
} from "@/lib/presenters/participation-warning-presentation";
import { cn } from "@auction/ui";
import { Info } from "lucide-react";

export type ParticipationWarningCalloutProps = {
  kind: LotParticipationWarningKind;
  detail: string;
  className?: string;
};

/** Larger warning callout for lot detail (onsite gating, etc.). */
export function ParticipationWarningCallout({
  kind,
  detail,
  className,
}: ParticipationWarningCalloutProps) {
  const presentation = lotParticipationWarningPresentation(kind);
  return (
    <div
      className={cn(participationWarningCalloutClassName, "flex items-start gap-3.5", className)}
    >
      <div className="rounded-full bg-primary-container/30 p-1.5 text-on-primary-fixed">
        <Info className="size-5 shrink-0" aria-hidden />
      </div>
      <div>
        <h3 className={participationWarningCalloutTitleClassName}>{presentation.label}</h3>
        <p className={participationWarningCalloutBodyClassName}>{detail}</p>
      </div>
    </div>
  );
}
