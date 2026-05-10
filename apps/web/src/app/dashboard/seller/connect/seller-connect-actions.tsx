"use client";

import {
  ensureStripeConnectAccountAction,
  startStripeConnectOnboardingAction,
} from "@/lib/actions/seller-stripe-connect";
import { Button } from "@auction/ui/components/button";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function SellerConnectActions({ ready }: { ready: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (ready) return null;

  return (
    <div className="space-y-3">
      {error ? <p className="font-body text-sm text-error">{error}</p> : null}
      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={pending}
          onClick={() => {
            setError(null);
            start(async () => {
              const r = await ensureStripeConnectAccountAction();
              if (!r.ok) setError(r.error ?? "Could not create Connect account.");
              else router.refresh();
            });
          }}
        >
          Create / refresh Connect account
        </Button>
        <Button
          type="button"
          variant="cta"
          size="sm"
          disabled={pending}
          onClick={() => {
            setError(null);
            start(async () => {
              const r = await startStripeConnectOnboardingAction();
              if (!r.ok) {
                setError(r.error);
                return;
              }
              window.location.assign(r.url);
            });
          }}
        >
          Continue in Stripe
        </Button>
      </div>
    </div>
  );
}
