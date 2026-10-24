"use client";

import { LoadingButton } from "@/components/account-button";
import { cancelAccountDeletionAction } from "@/server/application/account-identity-actions.server";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

/**
 * Cancels a deletion during its grace period. It only restores the account as it was, so it
 * needs no fresh sign-in; if the sign-in has ended the issuer says so and the person is told.
 */
export function CancelDeletionButton() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-2">
      <LoadingButton
        type="button"
        variant="cta"
        loading={pending}
        loadingLabel="Cancelling…"
        className="min-h-11"
        onClick={() =>
          startTransition(async () => {
            const result = await cancelAccountDeletionAction();
            if (result.status === "ok") {
              router.refresh();
              return;
            }
            setError(
              result.status === "error"
                ? result.message
                : "Your sign-in has ended. Sign in again, then cancel the deletion.",
            );
          })
        }
      >
        Cancel deletion
      </LoadingButton>
      <div aria-live="polite">
        {error ? (
          <p role="alert" className="text-sm text-error">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
