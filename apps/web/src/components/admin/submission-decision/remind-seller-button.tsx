"use client";

import { adminRemindSellerIdentityAction } from "@/lib/actions/admin-consignment-after-sale";
import type { IdentityReminderView } from "@/lib/admin/submissions/identity-reminder-view";
import { notify } from "@/lib/ui/notify";
import { StaffButton } from "@auction/staff-ui";
import { BellRing } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useTransition } from "react";

type Props = {
  submissionId: string;
  view: IdentityReminderView;
};

/**
 * "Remind the seller" while acceptance waits for their identity. It sends at most one reminder a
 * day; until the next may go out it is disabled and says when the last one went.
 */
export function RemindSellerButton({ submissionId, view }: Props) {
  const router = useRouter();
  const statusId = useId();
  const [pending, startTransition] = useTransition();

  const remind = () =>
    startTransition(async () => {
      const r = await adminRemindSellerIdentityAction(submissionId);
      if (!r.ok) {
        notify.error(r.error);
        return;
      }
      notify.success(
        r.data?.sent ? "Reminder sent to the seller" : "The seller was already reminded today",
      );
      router.refresh();
    });

  return (
    <div className="flex flex-col items-start gap-1.5 sm:items-end">
      <StaffButton
        type="button"
        size="sm"
        variant="secondary"
        icon={<BellRing aria-hidden />}
        loading={pending}
        disabled={!view.canSend}
        aria-describedby={view.status ? statusId : undefined}
        onClick={remind}
      >
        Remind the seller
      </StaffButton>
      {view.status ? (
        <p id={statusId} className="text-staff-xs text-staff-muted">
          {view.status}
        </p>
      ) : null}
    </div>
  );
}
