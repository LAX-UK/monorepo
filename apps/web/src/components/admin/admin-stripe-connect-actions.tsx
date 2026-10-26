"use client";

import {
  adminCreateStripeConnectOnboardingLinkAction,
  adminSyncStripeConnectAction,
} from "@/lib/actions/admin-stripe-connect.actions";
import { Notice, StaffButton } from "@auction/staff-ui";
import type { LegalEntity } from "@auction/types";
import { Link2, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type Props = {
  entity: LegalEntity;
};

/**
 * Stripe Connect support tools: sync after a change in the Stripe dashboard, or copy a hosted
 * onboarding link as a fallback to the seller's embedded setup. A refusal shows here, in place.
 */
export function AdminStripeConnectActions({ entity }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<"sync" | "link" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-3">
      <p className="text-staff-sm text-staff-muted">
        Embedded Connect setup is for the seller. Sync after a change in the Stripe dashboard, or
        copy a hosted onboarding link as a fallback.
      </p>
      {message ? <Notice tone="success" title={message} /> : null}
      {error ? (
        <Notice tone="danger" alert title="That did not work">
          {error}
        </Notice>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <StaffButton
          variant="secondary"
          size="sm"
          icon={<RefreshCw aria-hidden />}
          loading={pending && busy === "sync"}
          disabled={pending}
          onClick={() => {
            setMessage(null);
            setError(null);
            setBusy("sync");
            startTransition(async () => {
              const res = await adminSyncStripeConnectAction(entity.id);
              if (!res.ok) {
                setError(res.error ?? "Sync failed.");
                return;
              }
              setMessage("Synced from Stripe");
              router.refresh();
            });
          }}
        >
          Sync now
        </StaffButton>
        <StaffButton
          variant="secondary"
          size="sm"
          icon={<Link2 aria-hidden />}
          loading={pending && busy === "link"}
          disabled={pending}
          {...(entity.stripeConnectAccountId
            ? {}
            : { disabledReason: "Connect an account before creating a link" })}
          onClick={() => {
            setMessage(null);
            setError(null);
            setBusy("link");
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
                setMessage("Onboarding link copied to the clipboard");
              } catch {
                setMessage(res.url);
              }
            });
          }}
        >
          Copy onboarding link
        </StaffButton>
      </div>
    </div>
  );
}
