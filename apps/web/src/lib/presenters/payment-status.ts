import type { PaymentStatus, PayoutStatus } from "@auction/types";

export type StatusBadgeTone = "success" | "danger" | "info" | "neutral";

export type StatusBadgeView = {
  /** Human-friendly label, en-GB. */
  label: string;
  /** Semantic tone for selecting badge classes. */
  tone: StatusBadgeTone;
  /** Tailwind class string for legacy `<span>` badges (payouts page).
   * Maps `tone` to the project's semantic colour tokens. */
  badgeClassName: string;
};

const TONE_CLASSES: Record<StatusBadgeTone, string> = {
  success: "bg-success/10 text-success",
  danger: "bg-error/10 text-error",
  info: "bg-primary/10 text-primary",
  neutral: "bg-surface-container text-on-surface-variant",
};

function view(label: string, tone: StatusBadgeTone): StatusBadgeView {
  return { label, tone, badgeClassName: TONE_CLASSES[tone] };
}

/** Single source of truth for payout status presentation. */
export function getPayoutStatusView(status: PayoutStatus): StatusBadgeView {
  switch (status) {
    case "scheduled":
      return view("Scheduled", "neutral");
    case "in_transit":
      return view("In transit", "info");
    case "paid":
      return view("Paid", "success");
    case "failed":
      return view("Failed", "danger");
    case "reversed":
      return view("Reversed", "danger");
    case "clawback_pending":
      return view("Manual reconciliation pending", "danger");
  }
}

/** Single source of truth for buyer-facing payment status presentation. */
export function getPaymentStatusView(status: PaymentStatus): StatusBadgeView {
  switch (status) {
    case "pending":
      return view("Awaiting payment", "neutral");
    case "authorized":
      return view("Authorised", "info");
    case "captured":
      return view("Paid", "success");
    case "refunded":
      return view("Refunded", "danger");
    case "requires_manual_review":
      return view("Awaiting manual review", "info");
  }
}
