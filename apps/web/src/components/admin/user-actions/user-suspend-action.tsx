"use client";

import { TypedConfirmationDialog } from "@/components/admin/typed-confirmation-dialog";
import { adminSuspendUserResultAction, adminUnsuspendUserResultAction } from "@/lib/actions/admin";
import { Can } from "@/lib/auth/capabilities";
import { handleStaffStepUp } from "@/lib/auth/step-up/staff-step-up.client";
import { USER_MODERATION_ACCESS } from "@/lib/navigation/staff-nav-access";
import { notify } from "@/lib/ui/notify";
import { StaffButton } from "@auction/staff-ui";
import { ADMIN_SUSPEND_REASON_MIN } from "@auction/validators";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

const SUSPEND_PHRASE = "SUSPEND";

export type UserSuspendActionProps = {
  userId: string;
  suspendedAt: string | null;
  fullWidthButton?: boolean;
};

export function UserSuspendAction({
  userId,
  suspendedAt,
  fullWidthButton,
}: UserSuspendActionProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const button = suspendedAt ? (
    <StaffButton
      variant="secondary"
      size="sm"
      className={fullWidthButton ? "w-full sm:w-auto" : undefined}
      loading={pending}
      onClick={() => {
        startTransition(() => {
          void (async () => {
            const r = await adminUnsuspendUserResultAction(userId);
            if (r.ok) {
              notify.success("Unsuspended");
              router.refresh();
              return;
            }
            if (handleStaffStepUp(r)) return;
            notify.error(r.error);
          })();
        });
      }}
    >
      {fullWidthButton ? "Unsuspend account" : "Unsuspend"}
    </StaffButton>
  ) : (
    <>
      <StaffButton
        variant="danger-secondary"
        size="sm"
        className={fullWidthButton ? "w-full sm:w-auto" : undefined}
        loading={pending}
        onClick={() => setConfirmOpen(true)}
      >
        {fullWidthButton ? "Suspend account" : "Suspend"}
      </StaffButton>
      <TypedConfirmationDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Suspend this account?"
        description="The user will be blocked from signing in."
        actionLabel="Suspend account"
        confirmationPhrase={SUSPEND_PHRASE}
        severity="danger"
        reason={{ label: "Reason for the suspension", minLength: ADMIN_SUSPEND_REASON_MIN }}
        onConfirm={(reason) => {
          startTransition(() => {
            void (async () => {
              const r = await adminSuspendUserResultAction(userId, { reason });
              if (r.ok) {
                notify.success("Suspended");
                router.refresh();
                return;
              }
              if (handleStaffStepUp(r)) return;
              notify.error(r.error);
            })();
          });
        }}
      />
    </>
  );

  return <Can requirement={USER_MODERATION_ACCESS}>{button}</Can>;
}
