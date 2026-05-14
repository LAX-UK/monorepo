import "server-only";

import type { KycStatusSummaryDto } from "@/lib/data/dto/dashboard-dtos";
import { formatMoney } from "@/lib/format-currency";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import Link from "next/link";

type Props = {
  summary: KycStatusSummaryDto;
};

export function KycVerificationBanner({ summary }: Props) {
  if (!summary.requiresKyc) return null;
  const exposure = formatMoney(summary.pendingExposure.total.toFixed(2));
  const threshold = formatMoney(summary.thresholdAmount.toFixed(2));
  return (
    <Alert className="border-outline-variant/40 bg-surface-container-low" data-testid="kyc-banner">
      <AlertTitle>Identity verification required</AlertTitle>
      <AlertDescription className="text-pretty">
        Your outstanding bids and commitments ({exposure}) meet our verification threshold (
        {threshold}). Complete Stripe Identity verification to keep bidding.
        <span className="mt-2 block">
          <Link
            className="font-medium underline underline-offset-2"
            href="/dashboard/verify-identity"
          >
            Verify identity
          </Link>
        </span>
      </AlertDescription>
    </Alert>
  );
}
