"use client";

import { ConnectWorkspace } from "@/components/connect/connect-workspace";
import { trackSellerConnectComplete } from "@/lib/analytics/sell-funnel";
import type { KycStatusSummaryDto } from "@/lib/data/dto/dashboard-dtos";
import type { StripeConnectStatus } from "@/lib/data/http/stripe-connect.server";
import { useCallback } from "react";

type Props = {
  publishableKey: string | null;
  connectEnforced: boolean;
  status: StripeConnectStatus | null;
  legalEntityId?: string;
  memberRole: string;
  entityStatus?: string;
  kycApproved?: boolean;
  kycSummary?: KycStatusSummaryDto | null;
  onStartKyc?: (
    returnUrl: string,
  ) => Promise<{ ok: true; url: string } | { ok: false; error: string }>;
  isLaxManaged?: boolean;
  returnPath?: string;
  showDashboardLink?: boolean;
  syncDegraded?: boolean;
};

/** Seller Connect page wrapper — fires sell-funnel analytics when payout setup completes. */
export function SellerConnectWorkspace(props: Props) {
  const onConnectReady = useCallback(() => {
    trackSellerConnectComplete();
  }, []);

  return <ConnectWorkspace {...props} onConnectReady={onConnectReady} />;
}
