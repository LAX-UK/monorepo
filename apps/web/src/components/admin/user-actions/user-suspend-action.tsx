"use client";

import { TypedConfirmationDialog } from "@/components/admin/typed-confirmation-dialog";
import { adminSuspendUserResultAction, adminUnsuspendUserResultAction } from "@/lib/actions/admin";
import { Can } from "@/lib/auth/capabilities";
import { USER_MODERATION_ACCESS } from "@/lib/navigation/staff-nav-access";
import { notify } from "@/lib/ui/notify";
import { StaffButton } from "@auction/staff-ui";
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
        description={`Type ${SUSPEND_PHRASE} to confirm. The user will be blocked from signing in.`}
        actionLabel="Suspend account"
        confirmationPhrase={SUSPEND_PHRASE}
        severity="danger"
        onConfirm={() => {
          startTransition(() => {
            void (async () => {
              const r = await adminSuspendUserResultAction(userId, { reason: "Admin action" });
              if (r.ok) {
                notify.success("Suspended");
                router.refresh();
                return;
              }
              notify.error(r.error);
            })();
          });
        }}
      />
    </>
  );

  return <Can requirement={USER_MODERATION_ACCESS}>{button}</Can>;
}
