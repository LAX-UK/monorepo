"use client";

import { LotConditionReportCard } from "@/components/sections/artwork/redesign/lot-condition-report-card";
import { useConditionReportRequest } from "@/hooks/use-condition-report-request";
import {
  isConditionReportDismissed,
  setConditionReportDismissed,
} from "@/lib/condition-report/condition-report-dismiss";
import type {
  ConditionReportRequestSnapshot,
  PublishedConditionReport,
} from "@/lib/condition-report/condition-report-types";
import { deriveConditionReportCardState } from "@/lib/condition-report/derive-condition-report-card-state";
import type { KycUserFeedbackDto } from "@/lib/data/dto/dashboard-dtos";
import type { ConditionReportRequestFormValues } from "@auction/validators";
import { useCallback, useMemo, useState, useSyncExternalStore } from "react";

type Props = {
  lotId: string;
  loginNextPath: string;
  isAuthenticated: boolean;
  show: boolean;
  lotEligible: boolean;
  kycApproved: boolean;
  kycFeedback?: KycUserFeedbackDto | null;
  publishedConditionReport?: PublishedConditionReport | null;
  buyerRequest?: ConditionReportRequestSnapshot | null;
  userId?: string | null;
};

const DASHBOARD_HREF = "/dashboard/condition-reports";

function subscribeDismiss(_onStoreChange: () => void) {
  return () => {};
}

export function ArtworkConditionReportCta({
  lotId,
  loginNextPath,
  isAuthenticated,
  show,
  lotEligible,
  kycApproved,
  kycFeedback = null,
  publishedConditionReport = null,
  buyerRequest = null,
  userId = null,
}: Props) {
  const [optimisticRequest, setOptimisticRequest] = useState<ConditionReportRequestSnapshot | null>(
    null,
  );
  const [dismissVersion, setDismissVersion] = useState(0);
  const { uiPhase, submitErrorMessage, submit } = useConditionReportRequest(lotId);

  const effectiveBuyerRequest = optimisticRequest ?? buyerRequest;

  const isDismissed = useSyncExternalStore(
    subscribeDismiss,
    () => isConditionReportDismissed(userId, lotId),
    () => false,
  );

  const bumpDismiss = useCallback(() => setDismissVersion((v) => v + 1), []);

  const onHide = useCallback(() => {
    setConditionReportDismissed(userId, lotId, true);
    bumpDismiss();
  }, [userId, lotId, bumpDismiss]);

  const onRestore = useCallback(() => {
    setConditionReportDismissed(userId, lotId, false);
    bumpDismiss();
  }, [userId, lotId, bumpDismiss]);

  void dismissVersion;

  const cardState = useMemo(
    () =>
      deriveConditionReportCardState({
        show,
        lotEligible,
        isAuthenticated,
        kycApproved,
        kycFeedback: kycFeedback?.detail ?? kycFeedback?.headline ?? null,
        loginNextPath,
        dashboardHref: DASHBOARD_HREF,
        published: publishedConditionReport,
        buyerRequest: effectiveBuyerRequest ?? null,
        uiPhase,
        submitErrorMessage,
      }),
    [
      show,
      lotEligible,
      isAuthenticated,
      kycApproved,
      kycFeedback,
      loginNextPath,
      publishedConditionReport,
      effectiveBuyerRequest,
      uiPhase,
      submitErrorMessage,
    ],
  );

  const onSubmitRequest = useCallback(
    async (values: ConditionReportRequestFormValues) => {
      const row = await submit(values.requestNote);
      if (row) {
        setOptimisticRequest(row);
      }
      return row != null;
    },
    [submit],
  );

  const submitting = uiPhase === "submitting";

  if (!cardState) return null;

  return (
    <LotConditionReportCard
      state={cardState}
      onSubmitRequest={onSubmitRequest}
      submitting={submitting}
      apiErrorMessage={submitErrorMessage}
      onHide={onHide}
      onRestore={onRestore}
      isDismissed={isDismissed}
    />
  );
}
