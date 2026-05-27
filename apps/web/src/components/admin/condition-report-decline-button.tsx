"use client";

import { ConfirmFormSubmit } from "@/components/admin/confirm-form-submit";
import { adminDeclineConditionReportAction } from "@/lib/actions/admin";
import { Textarea } from "@auction/ui/components/textarea";

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
      <Textarea
        name="responseNote"
        placeholder="Decline reason (optional)"
        className="min-h-14 font-body text-xs"
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
