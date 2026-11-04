"use client";

import { adminCompleteUnsoldFollowUpAction } from "@/lib/actions/admin-consignment-after-sale";
import { unsoldFollowUpView } from "@/lib/admin/submissions/unsold-follow-up-view";
import { notify } from "@/lib/ui/notify";
import { Notice, StaffButton } from "@auction/staff-ui";
import type { UnsoldLotFollowUp } from "@auction/types";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type Props = { submissionId: string; followUp: UnsoldLotFollowUp; currency: string };

/** The work a confirmed choice leaves behind, with the button that finishes it when staff do. */
export function UnsoldFollowUpBlock({ submissionId, followUp, currency }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [failure, setFailure] = useState<string | null>(null);
  const view = unsoldFollowUpView(followUp, currency);

  return (
    <div className="flex flex-col gap-3">
      <Notice tone={view.tone} title={view.title}>
        {view.detail}
      </Notice>
      {failure ? (
        <Notice tone="danger" alert title="It was not saved">
          {failure}
        </Notice>
      ) : null}
      {view.action ? (
        <div>
          <StaffButton
            type="button"
            variant="secondary"
            loading={pending}
            onClick={() =>
              startTransition(async () => {
                setFailure(null);
                const result = await adminCompleteUnsoldFollowUpAction(submissionId);
                if (result.ok) {
                  notify.success("Marked done");
                  router.refresh();
                  return;
                }
                setFailure(result.error);
              })
            }
          >
            {view.action}
          </StaffButton>
        </div>
      ) : null}
    </div>
  );
}
