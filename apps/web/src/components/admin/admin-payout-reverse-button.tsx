"use client";

import { TypedConfirmationDialog } from "@/components/admin/typed-confirmation-dialog";
import { reversePayoutAction } from "@/lib/admin/payout.actions";
import { Can } from "@/lib/auth/capabilities";
import { PAYOUT_REVERSE_ACCESS } from "@/lib/navigation/staff-nav-access";
import type { PayoutStatus } from "@auction/types";
import { Button } from "@auction/ui/components/button";
import { Textarea } from "@auction/ui/components/textarea";
import { useState, useTransition } from "react";

type Props = {
  payoutId: string;
  status: PayoutStatus;
};

export function AdminPayoutReverseButton({ payoutId, status }: Props) {
  const [reason, setReason] = useState("");
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const eligible = status === "paid" || status === "in_transit";
  const phrase = `REVERSE PAYOUT ${payoutId}`;
  const reasonOk = reason.trim().length >= 10;

  if (!eligible) return null;

  return (
    <Can requirement={PAYOUT_REVERSE_ACCESS}>
      <div className="space-y-3 rounded-md border border-border-hairline p-3">
        <h3 className="font-label text-sm font-semibold uppercase tracking-wide text-destructive">
          Reverse payout (bookkeeping)
        </h3>
        <p className="text-xs text-on-surface-variant">
          Marks this payout as reversed for finance records. Requires administrator payout.reverse
          capability.
        </p>
        {/* biome-ignore lint/a11y/noLabelWithoutControl: wraps Textarea component */}
        <label className="block space-y-1 text-sm">
          <span>Reason (min 10 characters)</span>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Explain why this payout is being reversed…"
            rows={3}
            className="resize-y"
          />
        </label>
        <Button
          type="button"
          variant="destructive"
          disabled={!reasonOk || pending}
          onClick={() => setOpen(true)}
        >
          Reverse payout…
        </Button>

        <TypedConfirmationDialog
          open={open}
          onOpenChange={setOpen}
          title="Confirm payout reversal"
          description="This updates payout status to reversed. Stripe transfers are not automatically clawed back."
          actionLabel="Reverse payout"
          confirmationPhrase={phrase}
          severity="danger"
          onConfirm={() => {
            startTransition(async () => {
              const fd = new FormData();
              fd.set("payoutId", payoutId);
              fd.set("reason", reason.trim());
              fd.set("confirmationPhrase", phrase);
              await reversePayoutAction(fd);
            });
          }}
        />
      </div>
    </Can>
  );
}
