"use client";

import { TypedConfirmationDialog } from "@/components/admin/typed-confirmation-dialog";
import { adminReturnLotToInventoryResultAction } from "@/lib/actions/admin";
import { notify } from "@/lib/ui/notify";
import type { LotStatus } from "@auction/types";
import { Button } from "@auction/ui/components/button";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type Props = {
  lotId: string;
  status: LotStatus;
  hasWinner: boolean;
  disabled?: boolean;
};

const ELIGIBLE: LotStatus[] = ["ended", "cancelled", "voided"];

/** Return-to-inventory control — parent gates visibility via `canManageAuction`. */
export function ReturnToInventoryButton({ lotId, status, hasWinner, disabled }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  if (!ELIGIBLE.includes(status) || hasWinner) return null;

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled || pending}
        onClick={() => setOpen(true)}
      >
        Return to inventory
      </Button>
      <TypedConfirmationDialog
        open={open}
        onOpenChange={setOpen}
        title="Return lot to inventory?"
        description="Clears sale assignment, lot number, winner, and pricing reset to starting price. Bid history is kept but marked non-winning."
        actionLabel="Return to inventory"
        confirmationPhrase="RETURN"
        severity="danger"
        onConfirm={async () => {
          const r = await new Promise<
            Awaited<ReturnType<typeof adminReturnLotToInventoryResultAction>>
          >((resolve) => {
            startTransition(() => {
              void adminReturnLotToInventoryResultAction(lotId, {
                reason: "Staff returned lot to inventory",
                confirmVoided: status === "voided",
              }).then(resolve);
            });
          });
          if (!r.ok) {
            notify.error(r.error);
            throw new Error(r.error);
          }
          notify.success("Lot returned to inventory");
          router.refresh();
        }}
      />
    </>
  );
}
