import "server-only";

import type { DashboardComplianceStripUser } from "@/components/dashboard/dashboard-compliance-strip";
import type { PayoutSetupPill } from "@/components/dashboard/overview/compliance-status-strip";
import { shouldShowSellerComplianceStrip } from "@/components/dashboard/overview/should-show-compliance-strip";
import { resolveSellerPayoutSetupPill } from "@/lib/connect/resolve-seller-payout-setup";
import { getServerDataContainer } from "@/lib/data/container.server";
import type { SessionUser } from "@/lib/data/contracts";
import type { KycStatusSummaryDto } from "@/lib/data/dto/dashboard-dtos";
import { getServerSessionUser } from "@/lib/data/http/session.server";
import { cache } from "react";

export type SellerComplianceChrome = {
  showStrip: boolean;
  kyc: KycStatusSummaryDto | null;
  addressesCount: number;
  payoutSetup: PayoutSetupPill | null;
};

/** Whether to show the page-level Connect alert (strip covers payout CTA when visible). */
export function shouldShowConnectPageAlert(
  chrome: Pick<SellerComplianceChrome, "showStrip" | "payoutSetup">,
  connectPresentation: { showBanner: boolean },
): boolean {
  if (!connectPresentation.showBanner) return false;
  if (chrome.showStrip && chrome.payoutSetup && !chrome.payoutSetup.ready) return false;
  return true;
}

function toComplianceStripUser(sessionUser: SessionUser): DashboardComplianceStripUser {
  const user: DashboardComplianceStripUser = {
    role: sessionUser.role,
    staffRole: sessionUser.staffRole ?? null,
    emailVerified: sessionUser.emailVerified ?? false,
  };
  if (sessionUser.emailStatus !== undefined) {
    user.emailStatus = sessionUser.emailStatus;
  }
  if (sessionUser.kycStatus !== undefined) {
    user.kycStatus = sessionUser.kycStatus;
  }
  if (sessionUser.twoFactorEnabled !== undefined) {
    user.twoFactorEnabled = sessionUser.twoFactorEnabled;
  }
  return user;
}

async function loadSellerComplianceChromeImpl(
  user: DashboardComplianceStripUser,
): Promise<SellerComplianceChrome> {
  const c = await getServerDataContainer();
  const [kycR, addressesR] = await Promise.allSettled([c.kyc.getSummary(), c.addresses.listMine()]);
  const kyc = kycR.status === "fulfilled" ? kycR.value : null;
  const addressesCount = addressesR.status === "fulfilled" ? addressesR.value.length : 0;

  const payoutSetup = await resolveSellerPayoutSetupPill({
    role: user.role,
    staffRole: user.staffRole ?? null,
  });

  const showStrip = shouldShowSellerComplianceStrip(user, kyc, addressesCount, payoutSetup);
  return { showStrip, kyc, addressesCount, payoutSetup };
}

/** Per-request cached seller compliance chrome (dedupes layout + page fetches). */
export const loadSellerComplianceChrome = cache(
  async (userId: string): Promise<SellerComplianceChrome> => {
    const sessionUser = await getServerSessionUser();
    if (!sessionUser || sessionUser.id !== userId) {
      throw new Error("seller_compliance_chrome_session_mismatch");
    }
    return loadSellerComplianceChromeImpl(toComplianceStripUser(sessionUser));
  },
);
