"use client";

import { Button } from "@auction/ui/components/button";
import { normalizeApiErrorMessage } from "@auction/validators";
import { Loader2 } from "lucide-react";

type Props = {
  preparingAccount: boolean;
  ensureError: string | null;
  pending: boolean;
  onRetry: () => void;
};

export function ConnectPreparingPanel({ preparingAccount, ensureError, pending, onRetry }: Props) {
  const statusMessage = preparingAccount
    ? "Setting up your secure payout account…"
    : "Loading payout setup…";

  return (
    <div
      className="rounded-lg border border-outline-variant/30 p-6"
      aria-live="polite"
      aria-busy={preparingAccount}
    >
      <div className="flex items-center gap-2">
        {preparingAccount ? (
          <Loader2 className="size-4 animate-spin text-on-surface-variant" aria-hidden />
        ) : null}
        <p className="font-body text-sm text-on-surface-variant">{statusMessage}</p>
      </div>
      {ensureError ? (
        <div className="mt-3 space-y-2">
          <p className="font-body text-sm text-error" role="alert">
            {normalizeApiErrorMessage(ensureError, "Could not create Connect account.")}
          </p>
          <Button type="button" variant="secondary" size="sm" disabled={pending} onClick={onRetry}>
            Try again
          </Button>
        </div>
      ) : null}
    </div>
  );
}
