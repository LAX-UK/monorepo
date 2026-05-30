import {
  DashboardComplianceStrip,
  DashboardComplianceStripSkeleton,
} from "@/components/dashboard/dashboard-compliance-strip";
import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import type { ReactNode } from "react";
import { Suspense } from "react";

export default async function SellerDashboardLayout({ children }: { children: ReactNode }) {
  const user = await requireAuthenticatedUser({
    shell: "client",
    loginNext: "/dashboard/seller",
  });

  return (
    <div className="space-y-8">
      <Suspense fallback={<DashboardComplianceStripSkeleton />}>
        <DashboardComplianceStrip user={user} loginNext="/dashboard/seller" includePayoutSetup />
      </Suspense>
      {children}
    </div>
  );
}
