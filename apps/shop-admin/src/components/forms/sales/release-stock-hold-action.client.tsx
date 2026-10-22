"use client";

import { AdminMutationFeedback } from "@/components/admin-mutation-feedback";
import { useAdminMutation } from "@/components/use-admin-mutation";
import { releaseStockHold } from "@/server/application/admin-sales-actions.server";
import { Button, ConfirmDialog } from "@auction/ui";
import { useState } from "react";

export function ReleaseStockHoldAction({
  holdId,
  artworkTitle,
  editionNumber,
}: {
  holdId: string;
  artworkTitle: string;
  editionNumber: number;
}) {
  const { pending, idempotencyKey, message, stepUpRequired, stepUpHref, run } = useAdminMutation();
  const [confirming, setConfirming] = useState(false);
  const edition = `${artworkTitle}, edition ${editionNumber}`;

  return (
    <div className="space-y-1">
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() => setConfirming(true)}
      >
        Release
      </Button>
      <AdminMutationFeedback
        message={message}
        stepUpRequired={stepUpRequired}
        stepUpHref={stepUpHref}
      />
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={`Release hold on ${edition}`}
        body="The edition goes back on sale straight away. The hold cannot be reinstated; create a new hold if the client still wants it."
        confirmLabel="Release hold"
        loading={pending}
        onConfirm={async () => {
          await run(() => releaseStockHold({ holdId, idempotencyKey }), "Hold released");
          setConfirming(false);
        }}
      />
    </div>
  );
}
