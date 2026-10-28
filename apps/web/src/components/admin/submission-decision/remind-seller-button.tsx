"use client";

import { adminRemindSellerIdentityAction } from "@/lib/actions/admin-consignment-after-sale";
import { notify } from "@/lib/ui/notify";
import { StaffButton } from "@auction/staff-ui";
import { BellRing } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

type Props = {
  submissionId: string;
  /** Another reminder may go out now; at most one a day. */
  canSend: boolean;
  /** The id of the line saying when the last reminder went. */
  describedBy?: string;
};

/** "Remind the seller" while acceptance waits for their identity. */
export function RemindSellerButton({ submissionId, canSend, describedBy }: Props) {
  const router = useRouter();
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
    <StaffButton
      type="button"
      size="sm"
      variant="secondary"
      icon={<BellRing aria-hidden />}
      loading={pending}
      disabled={!canSend}
      aria-describedby={describedBy}
      onClick={remind}
    >
      Remind the seller
    </StaffButton>
  );
}
