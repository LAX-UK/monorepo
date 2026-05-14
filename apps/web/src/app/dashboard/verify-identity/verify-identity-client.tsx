"use client";

import { startKycVerification } from "@/app/dashboard/verify-identity/actions";
import { DashboardSkeleton } from "@/components/dashboard/primitives/dashboard-skeleton";
import { Button } from "@auction/ui/components/button";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

export function VerifyIdentityClient() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const onStart = useCallback(async () => {
    setBusy(true);
    setMessage(null);
    const result = await startKycVerification();
    setBusy(false);
    if (!result.ok) {
      setMessage(result.error);
      return;
    }
    window.location.assign(result.url);
  }, []);

  return (
    <div className="max-w-lg space-y-4">
      {busy ? (
        <div aria-live="polite" aria-busy="true" className="py-2">
          <DashboardSkeleton variant="list" />
        </div>
      ) : null}
      <p className="text-sm text-on-surface-variant">
        You will leave this site briefly to complete document and selfie checks with Stripe. When
        finished, you will return to your dashboard.
      </p>
      {message ? (
        <p className="text-sm text-error" role="alert">
          {message}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <Button type="button" disabled={busy} onClick={onStart}>
          Continue to Stripe
        </Button>
        <Button type="button" variant="outline" disabled={busy} onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
