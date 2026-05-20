"use client";

import { TypedConfirmationDialog } from "@/components/admin/typed-confirmation-dialog";
import { adminApproveWithdrawalRequestResultAction } from "@/lib/actions/admin";
import { notify } from "@/lib/ui/notify";
import { Button } from "@auction/ui/components/button";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

const APPROVE_PHRASE = "APPROVE WITHDRAWAL";

type Props = { lotId: string };

export function WithdrawalApproveButton({ lotId }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="default"
        size="sm"
        disabled={pending}
        onClick={() => setOpen(true)}
      >
        {pending ? "Approving…" : "Approve withdrawal"}
      </Button>
      <TypedConfirmationDialog
        open={open}
        onOpenChange={setOpen}
        title="Approve lot withdrawal?"
        description={`Type ${APPROVE_PHRASE} to cancel the lot and approve the seller withdrawal request.`}
        actionLabel="Approve withdrawal"
        confirmationPhrase={APPROVE_PHRASE}
        severity="warning"
        onConfirm={() => {
          startTransition(async () => {
            const r = await adminApproveWithdrawalRequestResultAction(lotId);
            if (r.ok) {
              notify.success("Withdrawal approved — lot cancelled");
              router.refresh();
            } else {
              notify.error("Approval failed", { description: r.error });
            }
          });
        }}
      />
    </>
  );
}
