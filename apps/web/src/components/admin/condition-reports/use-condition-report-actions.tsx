"use client";

import { useStaffConfirm } from "@/components/admin/staff/use-staff-confirm";
import {
  adminDeclineConditionReportResultAction,
  adminMarkConditionReportInProgressResultAction,
} from "@/lib/actions/admin";
import type { ConditionReportStatusCode } from "@/lib/admin/condition-reports/condition-reports-staff-list.vm";
import type { OverflowAction } from "@auction/staff-ui";
import { useCallback } from "react";

/** What the condition report actions need to know about a request. */
export type ConditionReportActionTarget = {
  id: string;
  lotTitle: string;
  status: ConditionReportStatusCode;
};

/**
 * A request's state-changing actions, the same from a list row's `…` menu and the panel: mark it
 * as in progress, and decline it. Declining asks first and takes a reason, which is kept with the
 * request. Fulfilling is a form, so it lives in the panel; `fulfil` opens it. Closed requests
 * have no actions.
 */
export function useConditionReportActions({
  openPanel,
  afterDecline,
}: {
  /** Opens the request's panel, where the fulfil form is. */
  openPanel: (id: string) => void;
  /** Runs after a decline succeeds, instead of only refreshing the list. */
  afterDecline?: () => void;
}) {
  const confirm = useStaffConfirm();
  const { ask } = confirm;

  const markInProgress = useCallback(
    (request: ConditionReportActionTarget) =>
      ask({
        title: `Mark the request for ${request.lotTitle} as in progress?`,
        description: "Other staff can then see that someone has picked it up.",
        confirmLabel: "Mark in progress",
        run: () => adminMarkConditionReportInProgressResultAction(request.id),
        success: "Request marked as in progress",
      }),
    [ask],
  );

  const decline = useCallback(
    (request: ConditionReportActionTarget) =>
      ask({
        title: `Decline the request for ${request.lotTitle}?`,
        description:
          "No condition report will be published for this lot, and the request closes. This cannot be undone.",
        confirmLabel: "Decline request",
        cancelLabel: "Keep request",
        tone: "danger",
        reason: {
          label: "Reason for declining",
          description: "Kept with the request.",
          maxLength: 2000,
        },
        run: ({ reason }) => adminDeclineConditionReportResultAction(request.id, reason),
        success: "Request declined",
        ...(afterDecline ? { onSuccess: afterDecline } : {}),
      }),
    [ask, afterDecline],
  );

  const actionsFor = useCallback(
    (request: ConditionReportActionTarget): OverflowAction[] => {
      if (request.status === "fulfilled" || request.status === "declined") return [];
      const actions: OverflowAction[] = [
        { id: "fulfil", label: "Fulfil and publish…", onSelect: () => openPanel(request.id) },
      ];
      if (request.status === "pending") {
        actions.push({
          id: "in-progress",
          label: "Mark in progress",
          onSelect: () => markInProgress(request),
        });
      }
      actions.push({
        id: "decline",
        label: "Decline request…",
        tone: "danger",
        onSelect: () => decline(request),
      });
      return actions;
    },
    [openPanel, markInProgress, decline],
  );

  return { actionsFor, markInProgress, decline, dialogs: confirm.dialog };
}
