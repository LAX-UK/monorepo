"use client";

import type { PortalPayeeConnectSurface } from "@auction/shop-contracts";
import { cn } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import { DotStatusPill } from "@auction/ui/components/dot-status-pill";
import { type StripeConnectInstance, loadConnectAndInitialize } from "@stripe/connect-js";
import {
  ConnectAccountManagement,
  ConnectAccountOnboarding,
  ConnectComponentsProvider,
} from "@stripe/react-connect-js";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import type { PayoutAccountViewModel } from "../vm/payout-account.vm.js";

export type PayoutAccountSessionResult =
  | { ok: true; clientSecret: string }
  | { ok: false; reason: "sign_in_required" | "unavailable" };

export type PayoutAccountPanelProps = {
  viewModel: PayoutAccountViewModel;
  publishableKey: string | null;
  createPayoutAccountSession: (
    surface: PortalPayeeConnectSurface,
  ) => Promise<PayoutAccountSessionResult>;
};

function cssVar(name: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

export function PayoutAccountPanel({
  viewModel,
  publishableKey,
  createPayoutAccountSession,
}: PayoutAccountPanelProps) {
  const router = useRouter();
  const [instance, setInstance] = useState<StripeConnectInstance | null>(null);
  const [error, setError] = useState<string | null>(null);

  const open = useCallback(() => {
    if (!publishableKey) return;
    setError(null);
    try {
      setInstance(
        loadConnectAndInitialize({
          publishableKey,
          fetchClientSecret: async () => {
            const result = await createPayoutAccountSession(viewModel.surface);
            if (result.ok) return result.clientSecret;
            const message =
              result.reason === "sign_in_required"
                ? "Sign in again to continue."
                : "We could not open payout setup. Try again shortly.";
            setError(message);
            throw new Error(message);
          },
          appearance: {
            overlays: "dialog",
            variables: {
              colorPrimary: cssVar("--color-primary", "#000000"),
              colorText: cssVar("--color-on-surface", "#1a1614"),
              colorDanger: cssVar("--color-error", "#b3261e"),
              fontFamily: "var(--font-body, system-ui, sans-serif)",
              borderRadius: "8px",
            },
          },
        }),
      );
    } catch {
      setError("We could not load Stripe. Try again shortly.");
    }
  }, [createPayoutAccountSession, publishableKey, viewModel.surface]);

  const close = useCallback(() => {
    setInstance(null);
    router.refresh();
  }, [router]);

  return (
    <section
      aria-labelledby="payout-account-heading"
      className="rounded-md border border-outline-variant p-4 text-sm"
      data-testid="payout-account-panel"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="payout-account-heading" className="font-medium">
          {viewModel.title}
        </h2>
        <DotStatusPill label={viewModel.statusLabel} tone={viewModel.tone} />
      </div>
      <p className="mt-1 text-on-surface-variant">{viewModel.description}</p>

      {instance ? (
        <div className="mt-4 min-h-[420px]">
          <ConnectComponentsProvider connectInstance={instance}>
            {viewModel.surface === "onboarding" ? (
              <ConnectAccountOnboarding
                onExit={close}
                collectionOptions={{ fields: "eventually_due", futureRequirements: "include" }}
              />
            ) : (
              <ConnectAccountManagement />
            )}
          </ConnectComponentsProvider>
        </div>
      ) : publishableKey ? (
        <Button
          type="button"
          variant="cta"
          size="md"
          className={cn("shop-focus-ring mt-3")}
          onClick={open}
        >
          {viewModel.actionLabel}
        </Button>
      ) : (
        <p className="mt-3 text-on-surface-variant">
          Payout setup is not available yet. Please check back soon.
        </p>
      )}
      {error ? (
        <p role="alert" className="mt-2 text-error">
          {error}
        </p>
      ) : null}
    </section>
  );
}
