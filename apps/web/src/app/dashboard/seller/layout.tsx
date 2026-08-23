import { ComplianceStatusStrip } from "@/components/dashboard/overview/compliance-status-strip";
import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import { loadSellerComplianceChrome } from "@/lib/connect/seller-compliance-chrome.server";
import type { ReactNode } from "react";

export default async function SellerDashboardLayout({ children }: { children: ReactNode }) {
  const user = await requireAuthenticatedUser({
    shell: "client",
    loginNext: "/dashboard/seller",
  });

  const chrome = await loadSellerComplianceChrome(user.id);

  return (
    <div className="space-y-8">
      {chrome.showStrip ? (
        <ComplianceStatusStrip
          user={user}
          kyc={chrome.kyc}
          addressesCount={chrome.addressesCount}
          payoutSetup={chrome.payoutSetup}
        />
      ) : null}
      {children}
    </div>
  );
}
