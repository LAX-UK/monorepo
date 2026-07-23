import {
  paymentStatusLabel,
  paymentStatusToBadgeVariant,
  payoutStatusLabel,
  payoutStatusToBadgeVariant,
} from "@/lib/presenters/status-presentation";
import type { PaymentStatus, PayoutStatus } from "@auction/types";
import { presentationToDotStatus, statusBadgeVariantToDotTone } from "@auction/ui";

export type StatusBadgeTone = "success" | "danger" | "info" | "neutral";

export type StatusBadgeView = {
  /** Human-friendly label, en-GB. */
  label: string;
  /** Semantic tone for selecting badge classes. */
  tone: StatusBadgeTone;
  /** @deprecated Use DotStatusPill via registry bridge. */
  badgeClassName: string;
};

const TONE_CLASSES: Record<StatusBadgeTone, string> = {
  success: "bg-success/10 text-success",
  danger: "bg-error/10 text-error",
  info: "bg-primary/10 text-primary",
  neutral: "bg-surface-container text-on-surface-variant",
};

function variantToTone(variant: ReturnType<typeof paymentStatusToBadgeVariant>): StatusBadgeTone {
  const dotTone = statusBadgeVariantToDotTone(variant);
  if (dotTone === "success") return "success";
  if (dotTone === "critical") return "danger";
  if (dotTone === "info" || dotTone === "pending" || dotTone === "draft") return "info";
  if (dotTone === "warning") return "info";
  return "neutral";
}

function viewFromRegistry(
  label: string,
  variant: ReturnType<typeof paymentStatusToBadgeVariant>,
): StatusBadgeView {
  const tone = variantToTone(variant);
  return { label, tone, badgeClassName: TONE_CLASSES[tone] };
}

/** Single source of truth for payout status presentation. */
export function getPayoutStatusView(status: PayoutStatus): StatusBadgeView {
  const variant = payoutStatusToBadgeVariant(status);
  const label = payoutStatusLabel[status];
  return viewFromRegistry(label, variant);
}

/** Dashboard payment row chip — bridges legacy tone to Tag-Review pill. */
export function paymentDisplayDotStatus(label: string, tone: StatusBadgeTone) {
  const variant =
    tone === "danger"
      ? ("danger" as const)
      : tone === "success"
        ? ("success" as const)
        : tone === "info"
          ? ("info" as const)
          : ("neutral" as const);
  return presentationToDotStatus({ label, variant });
}

/** Single source of truth for buyer-facing payment status presentation. */
export function getPaymentStatusView(status: PaymentStatus): StatusBadgeView {
  const variant = paymentStatusToBadgeVariant(status);
  const label = paymentStatusLabel[status];
  const presentation = presentationToDotStatus({ label, variant });
  const tone = variantToTone(variant);
  if (status === "pending") {
    return viewFromRegistry("Awaiting payment", variant);
  }
  if (status === "authorized") {
    return viewFromRegistry("Awaiting bank transfer confirmation", variant);
  }
  if (status === "captured") {
    return viewFromRegistry("Paid", variant);
  }
  if (status === "requires_manual_review") {
    return viewFromRegistry("Awaiting manual review", variant);
  }
  return { label: presentation.label, tone, badgeClassName: TONE_CLASSES[tone] };
}
