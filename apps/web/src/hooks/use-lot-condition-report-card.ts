"use client";

import { useConditionReportRequest } from "@/hooks/use-condition-report-request";
import {
  isConditionReportDismissed,
  setConditionReportDismissed,
} from "@/lib/condition-report/condition-report-dismiss";
import type { ConditionReportRequestPort } from "@/lib/condition-report/condition-report-request.port";
import type { ConditionReportRequestSnapshot } from "@/lib/condition-report/condition-report-types";
import { deriveConditionReportCardState } from "@/lib/condition-report/derive-condition-report-card-state";
import type { LotConditionReportSessionInput } from "@/lib/condition-report/lot-condition-report-session-input";
import type { ConditionReportRequestFormValues } from "@auction/validators";
import { useCallback, useMemo, useState, useSyncExternalStore } from "react";

function subscribeDismiss(_onStoreChange: () => void) {
  return () => {};
}

export function useLotConditionReportCard(
  input: LotConditionReportSessionInput,
  port?: ConditionReportRequestPort,
) {
  const [optimisticRequest, setOptimisticRequest] = useState<ConditionReportRequestSnapshot | null>(
    null,
  );
  const [dismissVersion, setDismissVersion] = useState(0);
  const { uiPhase, submitErrorMessage, submit } = useConditionReportRequest(input.lotId, port);

  const userId = input.session?.userId ?? null;
  const effectiveBuyerRequest = optimisticRequest ?? input.buyerRequest;

  const isDismissed = useSyncExternalStore(
    subscribeDismiss,
    () => isConditionReportDismissed(userId, input.lotId),
    () => false,
  );

  const bumpDismiss = useCallback(() => setDismissVersion((v) => v + 1), []);
  void dismissVersion;

  const cardState = useMemo(() => {
    const session = input.session;
    return deriveConditionReportCardState({
      show: input.show,
      isAuthenticated: session?.isAuthenticated ?? false,
      emailVerified: session?.emailVerified ?? false,
      userEmail: session?.email ?? null,
      kycStatus: session?.kycStatus ?? "unverified",
      kycFeedback: session?.kycFeedback ?? null,
      loginNextPath: input.loginNextPath,
      published: input.published,
      buyerRequest: effectiveBuyerRequest ?? null,
      uiPhase,
      submitErrorMessage,
    });
  }, [input, effectiveBuyerRequest, uiPhase, submitErrorMessage]);

  const onHide = useCallback(() => {
    setConditionReportDismissed(userId, input.lotId, true);
    bumpDismiss();
  }, [userId, input.lotId, bumpDismiss]);

  const onRestore = useCallback(() => {
    setConditionReportDismissed(userId, input.lotId, false);
    bumpDismiss();
  }, [userId, input.lotId, bumpDismiss]);

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

  return {
    cardState,
    isDismissed,
    onHide,
    onRestore,
    onSubmitRequest,
    canParticipate: input.canParticipate,
  };
}
