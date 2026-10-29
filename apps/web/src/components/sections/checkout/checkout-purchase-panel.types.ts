import type { SessionUser } from "@/lib/data/contracts";
import type { ManualReviewReason, PaymentStatus } from "@auction/types";

export type CheckoutOrderSummary = {
  hammer: string;
  buyerPremium: string;
  total: string;
  premiumPercentLabel: string;
};

export type CheckoutPricing = {
  totalMinor?: number | undefined;
  currency?: string;
};

export type CheckoutPaymentLifecycle = {
  paymentComplete?: boolean;
  openPaymentStatus?: PaymentStatus | null;
  openPaymentManualReviewReason?: ManualReviewReason | null;
  openPaymentCheckoutRail?: "card" | "gb_bank_transfer" | null;
  paymentsLoadFailed?: boolean;
  preflightComplianceGate?: "clear" | "aml_hold" | "source_of_funds_required" | null;
  stripeReturnSuccess?: boolean;
};

export type CheckoutBuyerContext = {
  sessionUser: SessionUser;
  lotId: string;
  lotTitle: string;
  addresses: unknown[];
  /** The organisation being paid for, named on the confirm button; `null` for a personal purchase. */
  payingFor?: string | null;
};

export type CheckoutPurchasePanelProps = CheckoutOrderSummary &
  CheckoutPricing &
  CheckoutPaymentLifecycle &
  CheckoutBuyerContext;
