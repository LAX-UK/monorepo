"use client";

import {
  adminCreateStripeConnectOnboardingLinkAction,
  adminSyncStripeConnectAction,
} from "@/lib/actions/admin-stripe-connect.actions";
import type { LegalEntity } from "@auction/types";
import { Button } from "@auction/ui/components/button";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type Props = {
  entity: LegalEntity;
};

export function AdminStripeConnectActions({ entity }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-3 border-t border-border-hairline pt-4">
      <p className="font-body text-sm text-on-surface-variant">
        Ops tools — embedded Connect is seller-facing; use sync after Stripe dashboard changes or
        copy a hosted onboarding link as fallback.
      </p>
      {message ? <p className="text-sm text-primary">{message}</p> : null}
      {error ? (
        <p className="text-sm text-error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={pending}
          onClick={() => {
            setMessage(null);
            setError(null);
            startTransition(async () => {
              const res = await adminSyncStripeConnectAction(entity.id);
              if (!res.ok) {
                setError(res.error ?? "Sync failed.");
                return;
              }
              setMessage("Synced from Stripe.");
              router.refresh();
            });
          }}
        >
          Sync now
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending || !entity.stripeConnectAccountId}
          onClick={() => {
            setMessage(null);
            setError(null);
            startTransition(async () => {
              const res = await adminCreateStripeConnectOnboardingLinkAction(
                entity.id,
                entity.kind === "organisation" ? "organisation" : "individual",
              );
              if (!res.ok) {
                setError(res.error ?? "Could not create link.");
                return;
              }
              try {
                await navigator.clipboard.writeText(res.url);
                setMessage("Onboarding link copied to clipboard.");
              } catch {
                setMessage(res.url);
              }
            });
          }}
        >
          Copy onboarding link
        </Button>
      </div>
    </div>
  );
}
