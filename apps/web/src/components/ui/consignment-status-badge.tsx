"use client";

import { AFTER_SALE_STAGE_PRESENTATION } from "@/lib/seller/consignment-stage-copy";
import {
  type ConsignmentStage,
  type ItemSubmissionStatus,
  itemSubmissionStatuses,
} from "@auction/types";
import { StatusPillWithHint, SubmissionStatusBadge } from "./submission-status-badge";

function isSubmissionStatus(stage: ConsignmentStage): stage is ItemSubmissionStatus {
  return (itemSubmissionStatuses as readonly string[]).includes(stage);
}

/** A consignment's stage: its submission status, or where it is after the sale. */
export function ConsignmentStatusBadge({ stage }: { stage: ConsignmentStage }) {
  if (isSubmissionStatus(stage)) return <SubmissionStatusBadge status={stage} />;
  const presentation = AFTER_SALE_STAGE_PRESENTATION[stage];
  return (
    <StatusPillWithHint
      label={presentation.label}
      hint={presentation.hint}
      tone={presentation.tone}
    />
  );
}
