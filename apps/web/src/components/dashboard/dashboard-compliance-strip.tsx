import { ComplianceStatusStrip } from "@/components/dashboard/overview/compliance-status-strip";
import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import { resolveSellerPayoutSetupPill } from "@/lib/connect/resolve-seller-payout-setup";
import { getServerDataContainer } from "@/lib/data/container.server";
import type { SessionUser } from "@/lib/data/contracts";

export type DashboardComplianceStripUser = Pick<
  SessionUser,
  "emailVerified" | "emailStatus" | "kycStatus" | "twoFactorEnabled" | "role" | "staffRole"
>;

type DashboardComplianceStripProps = {
  className?: string;
  /** When set, skips an extra session round-trip (page already authenticated). */
  user?: DashboardComplianceStripUser;
  loginNext?: string;
  /** When true, include seller payout setup pill (seller layout). */
  includePayoutSetup?: boolean;
};

/** Server wrapper: loads KYC + address count and renders the account-readiness strip. */
export async function DashboardComplianceStrip({
  className,
  user: userProp,
  loginNext = "/dashboard",
  includePayoutSetup = false,
}: DashboardComplianceStripProps) {
  const user =
    userProp ??
    (await requireAuthenticatedUser({
      shell: "client",
      loginNext,
    }));

  const c = await getServerDataContainer();
  const [kycR, addressesR] = await Promise.allSettled([c.kyc.getSummary(), c.addresses.listMine()]);
  const kyc = kycR.status === "fulfilled" ? kycR.value : null;
  const addressesCount = addressesR.status === "fulfilled" ? addressesR.value.length : 0;

  let payoutSetup = null;
  if (includePayoutSetup) {
    payoutSetup = await resolveSellerPayoutSetupPill({
      role: user.role,
      staffRole: user.staffRole ?? null,
    });
  }

  return (
    <ComplianceStatusStrip
      user={user}
      kyc={kyc}
      addressesCount={addressesCount}
      hideIdentityPill={kyc?.requiresKyc === true}
      payoutSetup={payoutSetup}
      {...(className ? { className } : {})}
    />
  );
}

export function DashboardComplianceStripSkeleton({ className }: { className?: string }) {
  return (
    <div className={className} aria-hidden>
      <div className="h-[52px] animate-pulse rounded-2xl border border-border-hairline bg-surface-container-high/40" />
    </div>
  );
}
