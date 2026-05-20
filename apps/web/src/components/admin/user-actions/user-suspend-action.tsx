"use client";

import { TypedConfirmationDialog } from "@/components/admin/typed-confirmation-dialog";
import { adminSuspendUserResultAction, adminUnsuspendUserResultAction } from "@/lib/actions/admin";
import { Can } from "@/lib/auth/capabilities";
import { notify } from "@/lib/ui/notify";
import { Button } from "@auction/ui/components/button";
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
    <Button
      type="button"
      variant="secondary"
      className={fullWidthButton ? "min-h-11 w-full" : "min-h-11"}
      disabled={pending}
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
    </Button>
  ) : (
    <>
      <Button
        type="button"
        variant="destructive"
        className={fullWidthButton ? "min-h-11 w-full" : "min-h-11"}
        disabled={pending}
        onClick={() => setConfirmOpen(true)}
      >
        {fullWidthButton ? "Suspend account" : "Suspend"}
      </Button>
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

  return <Can requirement="platform.admin.full">{button}</Can>;
}
