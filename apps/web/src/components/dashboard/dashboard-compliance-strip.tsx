import { ComplianceStatusStrip } from "@/components/dashboard/overview/compliance-status-strip";
import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import { getServerDataContainer } from "@/lib/data/container.server";
import type { SessionUser } from "@/lib/data/contracts";

export type DashboardComplianceStripUser = Pick<
  SessionUser,
  "emailVerified" | "emailStatus" | "kycStatus" | "twoFactorEnabled"
>;

type DashboardComplianceStripProps = {
  className?: string;
  /** When set, skips an extra session round-trip (page already authenticated). */
  user?: DashboardComplianceStripUser;
  loginNext?: string;
};

/** Server wrapper: loads KYC + address count and renders the account-readiness strip. */
export async function DashboardComplianceStrip({
  className,
  user: userProp,
  loginNext = "/dashboard",
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

  return (
    <ComplianceStatusStrip
      user={user}
      kyc={kyc}
      addressesCount={addressesCount}
      hideIdentityPill={kyc?.requiresKyc === true}
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
