"use client";

import { ConfirmFormSubmit } from "@/components/admin/confirm-form-submit";
import { adminDeclineConditionReportAction } from "@/lib/actions/admin";

type Props = { requestId: string };

export function ConditionReportDeclineButton({ requestId }: Props) {
  const formId = `decline-condition-report-${requestId}`;

  return (
    <form
      id={formId}
      action={adminDeclineConditionReportAction}
      className="mt-3 flex flex-col gap-2"
    >
      <input type="hidden" name="requestId" value={requestId} />
      <textarea
        name="responseNote"
        placeholder="Decline reason (optional)"
        className="min-h-14 w-full rounded border border-outline-variant/40 bg-surface px-2 py-2 font-body text-xs"
      />
      <ConfirmFormSubmit
        formId={formId}
        size="sm"
        variant="outline"
        className="min-h-9 w-fit"
        confirmTitle="Decline condition report request?"
        confirmBody="The buyer will not receive a condition report for this lot."
        confirmLabel="Decline"
        tone="warning"
      >
        Decline
      </ConfirmFormSubmit>
    </form>
  );
}
