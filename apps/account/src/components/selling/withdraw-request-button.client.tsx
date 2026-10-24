"use client";

import { Button } from "@/components/account-button";
import { withdrawSaleRequestAction } from "@/server/application/selling-actions.server";
import { buildReauthHref } from "@/server/domain/account-reauth";
import { SELLING_ROUTES } from "@/server/domain/selling/selling-routes";
import { ConfirmDialog } from "@auction/ui/components/confirm-dialog";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

/** Withdraws a request LAX has not answered yet, after a confirmation. */
export function WithdrawRequestButton({
  requestId,
  artworkTitle,
}: {
  requestId: string;
  artworkTitle: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function withdraw() {
    setError(null);
    startTransition(async () => {
      const result = await withdrawSaleRequestAction(requestId);
      if (result.status === "reauth_required") {
        window.location.assign(buildReauthHref(SELLING_ROUTES.editions));
        return;
      }
      setConfirming(false);
      if (result.status === "error") setError(result.message);
      router.refresh();
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="link"
        size="inline"
        className="min-h-11 text-sm text-on-surface underline underline-offset-4"
        aria-label={`Withdraw request for ${artworkTitle}`}
        disabled={pending}
        onClick={() => setConfirming(true)}
      >
        Withdraw
      </Button>
      {error ? (
        <p role="alert" className="basis-full text-sm text-error">
          {error}
        </p>
      ) : null}
      <ConfirmDialog
        open={confirming}
        onOpenChange={(open) => {
          if (!pending) setConfirming(open);
        }}
        title="Withdraw this request?"
        body={`LAX won't review your request for ${artworkTitle}. You can send a new one at any time.`}
        confirmLabel="Withdraw request"
        cancelLabel="Keep request"
        tone="warning"
        loading={pending}
        onConfirm={withdraw}
      />
    </>
  );
}
