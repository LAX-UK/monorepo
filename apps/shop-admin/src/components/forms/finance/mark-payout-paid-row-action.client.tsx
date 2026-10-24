"use client";

import { AdminMutationFeedback } from "@/components/admin-mutation-feedback";
import { useAdminMutation } from "@/components/use-admin-mutation";
import { formatAdminDetailGbpPence } from "@/lib/admin-detail-format";
import { markPayoutPaid } from "@/server/application/admin-operations-actions.server";
import { PAYOUT_PAID_REFERENCE_MAX_LENGTH } from "@auction/shop-contracts";
import { Button, ConfirmDialog, Input } from "@auction/ui";
import { useState } from "react";

export function MarkPayoutPaidRowAction({
  payoutId,
  ownerDisplayName,
  netPence,
}: {
  payoutId: string;
  ownerDisplayName: string;
  netPence: number;
}) {
  const { pending, idempotencyKey, message, stepUpRequired, stepUpHref, run } = useAdminMutation();
  const [paidReference, setPaidReference] = useState("");
  const [confirming, setConfirming] = useState(false);
  const reference = paidReference.trim();
  const amount = formatAdminDetailGbpPence(netPence);

  return (
    <div className="min-w-[12rem] space-y-1">
      <Input
        aria-label={`Paid reference for ${ownerDisplayName}`}
        placeholder="Paid reference"
        maxLength={PAYOUT_PAID_REFERENCE_MAX_LENGTH}
        value={paidReference}
        disabled={pending}
        onChange={(event) => setPaidReference(event.target.value)}
      />
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={pending || !reference}
        onClick={() => setConfirming(true)}
      >
        Mark paid
      </Button>
      <AdminMutationFeedback
        message={message}
        stepUpRequired={stepUpRequired}
        stepUpHref={stepUpHref}
      />
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={`Mark ${ownerDisplayName}'s payout paid`}
        body={`${amount} to ${ownerDisplayName} is recorded as paid with reference "${reference}". This cannot be undone.`}
        confirmLabel={`Mark ${amount} paid`}
        tone="warning"
        loading={pending}
        onConfirm={async () => {
          await run(
            () => markPayoutPaid({ payoutId, paidReference: reference, idempotencyKey }),
            "Payout marked paid",
          );
          setConfirming(false);
        }}
      />
    </div>
  );
}
