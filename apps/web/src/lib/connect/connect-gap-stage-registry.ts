import type { ConnectGapStage } from "@auction/connect";
import type { StatusBadgeProps } from "@auction/ui/components/status-badge";

type ConnectGapStageCopy = {
  label: string;
  badgeVariant: NonNullable<StatusBadgeProps["variant"]>;
  summary: string;
  readOnlySummary: string;
  actionHint: string | null;
};

const FORM_HINT = "Use the secure form below to update your details.";

export const CONNECT_GAP_STAGE_REGISTRY: Record<ConnectGapStage, ConnectGapStageCopy> = {
  managed_by_lax: {
    label: "Managed by LAX",
    badgeVariant: "success",
    summary: "LAX manages payouts for this inventory — no Stripe Connect setup is required.",
    readOnlySummary:
      "Payout setup is incomplete. Ask an organisation owner or admin to finish setup.",
    actionHint: null,
  },
  not_started: {
    label: "Payout setup not started",
    badgeVariant: "warning",
    summary:
      "We'll set up a secure Stripe payout account, then you'll add bank details and verification below.",
    readOnlySummary:
      "Payout setup has not started. Ask an organisation owner or admin to begin setup.",
    actionHint: FORM_HINT,
  },
  kyc_required: {
    label: "Identity verification required",
    badgeVariant: "info",
    summary: "Complete identity verification before starting payout setup.",
    readOnlySummary:
      "Identity verification is required before payout setup can begin. Ask an organisation owner or admin to complete it.",
    actionHint: null,
  },
  onboarding_incomplete: {
    label: "Payout setup incomplete",
    badgeVariant: "warning",
    summary: "Finish payout setup in the secure form below so we can transfer your net proceeds.",
    readOnlySummary:
      "Payout setup is incomplete. Ask an organisation owner or admin to finish verification.",
    actionHint: FORM_HINT,
  },
  requirements_due: {
    label: "Action required",
    badgeVariant: "warning",
    summary: "Stripe needs a few details before we can send payouts. Complete the form below.",
    readOnlySummary:
      "Payout setup is incomplete. Ask an organisation owner or admin to finish verification.",
    actionHint: FORM_HINT,
  },
  ready: {
    label: "Payout ready",
    badgeVariant: "success",
    summary:
      "Your payout account is ready — approved lots can be scheduled once finance enables settlement.",
    readOnlySummary:
      "Payout setup is incomplete. Ask an organisation owner or admin to finish setup.",
    actionHint: null,
  },
  restricted: {
    label: "Account restricted",
    badgeVariant: "danger",
    summary: "This payout account can't be used right now. Contact support@lax.bid for help.",
    readOnlySummary:
      "This payout account can't be used right now. Ask an organisation owner or admin to contact support@lax.bid for help.",
    actionHint: null,
  },
};

const CONNECT_GAP_STAGE_FALLBACK: ConnectGapStageCopy = {
  label: "Payout setup",
  badgeVariant: "neutral",
  summary: "Complete payout setup to receive transfers.",
  readOnlySummary:
    "Payout setup is incomplete. Ask an organisation owner or admin to finish setup.",
  actionHint: null,
};

export function connectGapStageCopy(stage: ConnectGapStage): ConnectGapStageCopy {
  return CONNECT_GAP_STAGE_REGISTRY[stage] ?? CONNECT_GAP_STAGE_FALLBACK;
}
