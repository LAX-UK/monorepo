"use client";

import { Button } from "@/components/account-button";
import { CARD, CARD_PADDING, CARD_TITLE } from "@/components/account-ui";
import { createPayoutSessionAction } from "@/server/application/selling-actions.server";
import type { PayoutAccountVm } from "@/server/domain/selling/selling-payouts.vm";
import { cn } from "@auction/ui";
import { DotStatusPill } from "@auction/ui/components/dot-status-pill";
import { type StripeConnectInstance, loadConnectAndInitialize } from "@stripe/connect-js";
import {
  ConnectAccountManagement,
  ConnectAccountOnboarding,
  ConnectComponentsProvider,
} from "@stripe/react-connect-js";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

const TONE = { neutral: "neutral", warning: "warning", success: "success" } as const;

function cssVar(name: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

/**
 * The bank account LAX pays sales into, as a status card. The button opens Stripe's own setup
 * or management forms inside the card; Stripe holds the bank details, never LAX Account.
 */
export function PayoutAccountCard({ account }: { account: PayoutAccountVm }) {
  const router = useRouter();
  const [instance, setInstance] = useState<StripeConnectInstance | null>(null);
  const [error, setError] = useState<string | null>(null);
  const action = account.action;
  const publishableKey = account.publishableKey;

  const open = useCallback(() => {
    if (!publishableKey || !action) return;
    setError(null);
    try {
      setInstance(
        loadConnectAndInitialize({
          publishableKey,
          fetchClientSecret: async () => {
            const result = await createPayoutSessionAction(action.surface);
            if (result.ok) return result.clientSecret;
            const message =
              result.reason === "sign_in_required"
                ? "Your sign-in has ended. Sign in again to continue."
                : "We couldn't open payout setup just now. Please try again in a moment.";
            setError(message);
            setInstance(null);
            throw new Error(message);
          },
          appearance: {
            overlays: "dialog",
            variables: {
              colorPrimary: cssVar("--color-product-accent", "#0f766e"),
              colorText: cssVar("--color-on-surface", "#1c170d"),
              colorBackground: cssVar("--color-surface", "#ffffff"),
              colorDanger: cssVar("--color-error", "#ba1a1a"),
              fontFamily: "var(--font-body, system-ui, sans-serif)",
              borderRadius: "8px",
            },
          },
        }),
      );
    } catch {
      setError("We couldn't load Stripe just now. Please try again in a moment.");
    }
  }, [action, publishableKey]);

  const close = useCallback(() => {
    setInstance(null);
    router.refresh();
  }, [router]);

  return (
    <section
      aria-labelledby="payout-account-heading"
      className={cn(CARD, CARD_PADDING, "flex flex-col gap-4")}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h2 id="payout-account-heading" className={CARD_TITLE}>
          {account.title}
        </h2>
        <DotStatusPill label={account.statusLabel} tone={TONE[account.tone]} />
      </div>
      <p className="max-w-prose text-sm leading-6 text-on-surface-variant">{account.description}</p>
      {instance ? (
        <div className="min-h-[420px]">
          <ConnectComponentsProvider connectInstance={instance}>
            {action?.surface === "management" ? (
              <ConnectAccountManagement />
            ) : (
              <ConnectAccountOnboarding
                onExit={close}
                collectionOptions={{ fields: "eventually_due", futureRequirements: "include" }}
              />
            )}
          </ConnectComponentsProvider>
        </div>
      ) : action ? (
        <Button
          type="button"
          variant={account.stage === "ready" ? "outline" : "cta"}
          className="self-start"
          onClick={open}
        >
          {action.label}
        </Button>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-error">
          {error}
        </p>
      ) : null}
    </section>
  );
}
