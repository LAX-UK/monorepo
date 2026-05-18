import {
  DashboardComplianceStrip,
  DashboardComplianceStripSkeleton,
} from "@/components/dashboard/dashboard-compliance-strip";
import type { ReactNode } from "react";
import { Suspense } from "react";

export default function CheckoutDashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-6">
      <Suspense fallback={<DashboardComplianceStripSkeleton />}>
        <DashboardComplianceStrip loginNext="/dashboard/checkout" />
      </Suspense>
      {children}
    </div>
  );
}
