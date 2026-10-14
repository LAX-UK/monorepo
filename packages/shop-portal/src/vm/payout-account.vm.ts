import type { PortalPayeeConnectStatus, PortalPayeeConnectSurface } from "@auction/shop-contracts";

export type PayoutAccountStage = "not_started" | "action_required" | "ready";

export type PayoutAccountViewModel = {
  stage: PayoutAccountStage;
  title: string;
  description: string;
  tone: "neutral" | "warning" | "success";
  statusLabel: string;
  actionLabel: string;
  surface: PortalPayeeConnectSurface;
};

/** One LAX Art payout account covers lax.art and shop.lax.art; Bid payouts are separate (D38). */
export function buildPayoutAccountViewModel(
  status: PortalPayeeConnectStatus | null,
): PayoutAccountViewModel {
  if (!status?.stripeAccountId) {
    return {
      stage: "not_started",
      title: "Set up your LAX Art payout account",
      description:
        "Add your details and bank account once to receive payouts from lax.art and shop.lax.art. " +
        "This is separate from any LAX.bid payout account.",
      tone: "neutral",
      statusLabel: "Not set up",
      actionLabel: "Set up payouts",
      surface: "onboarding",
    };
  }
  if (!status.ready) {
    return {
      stage: "action_required",
      title: "Finish your payout account",
      description: status.disabledReason
        ? "Stripe has paused payouts until a few details are updated."
        : "A few details are still needed before we can send your payouts.",
      tone: "warning",
      statusLabel: "Action needed",
      actionLabel: "Continue setup",
      surface: "onboarding",
    };
  }
  return {
    stage: "ready",
    title: "Payout account ready",
    description: "LAX pays eligible sales into this bank account once each sale settles.",
    tone: "success",
    statusLabel: "Ready",
    actionLabel: "Manage payout details",
    surface: "management",
  };
}
