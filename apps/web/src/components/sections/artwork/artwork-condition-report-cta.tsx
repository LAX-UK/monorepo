"use client";

import { LotConditionReportCard } from "@/components/sections/artwork/redesign/lot-condition-report-card";
import { useLotConditionReportCard } from "@/hooks/use-lot-condition-report-card";
import type { ConditionReportRequestPort } from "@/lib/condition-report/condition-report-request.port";
import type { LotConditionReportSessionInput } from "@/lib/condition-report/lot-condition-report-session-input";

type Props = {
  model: LotConditionReportSessionInput;
  port?: ConditionReportRequestPort;
};

export function ArtworkConditionReportCta({ model, port }: Props) {
  const { cardState, isDismissed, onHide, onRestore, onSubmitRequest, canParticipate } =
    useLotConditionReportCard(model, port);

  if (!canParticipate) return null;
  if (!cardState) return null;

  return (
    <LotConditionReportCard
      state={cardState}
      onSubmitRequest={onSubmitRequest}
      onHide={onHide}
      onRestore={onRestore}
      isDismissed={isDismissed}
    />
  );
}
