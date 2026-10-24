"use client";

import { TypedConfirmationDialog } from "@/components/admin/typed-confirmation-dialog";
import { adminCancelLotResultAction } from "@/lib/actions/admin";
import { notify } from "@/lib/ui/notify";
import { StaffButton } from "@auction/staff-ui";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type Props = {
  lotId: string;
  disabled?: boolean;
};

/** Cancel control — parent gates visibility via `canCancel` (capability + lot status). */
export function CancelLotButton({ lotId, disabled }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  return (
    <>
      <StaffButton
        variant="danger-secondary"
        disabled={disabled}
        loading={pending}
        onClick={() => setOpen(true)}
      >
        Cancel auction
      </StaffButton>
      <TypedConfirmationDialog
        open={open}
        onOpenChange={setOpen}
        title="Cancel this auction?"
        description="Bidding will stop and the lot stays visible in admin lists as cancelled. Use delete for pre-live catalogue cleanup."
        actionLabel="Cancel auction"
        confirmationPhrase={lotId}
        severity="danger"
        onConfirm={async () => {
          const r = await new Promise<Awaited<ReturnType<typeof adminCancelLotResultAction>>>(
            (resolve) => {
              startTransition(() => {
                void adminCancelLotResultAction(lotId, {}).then(resolve);
              });
            },
          );
          if (!r.ok) {
            notify.error(r.error);
            throw new Error(r.error);
          }
          notify.success("Auction cancelled");
          router.refresh();
        }}
      />
    </>
  );
}
