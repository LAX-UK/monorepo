import { DashboardComplianceStrip } from "@/components/dashboard/dashboard-compliance-strip";
import type { ReactNode } from "react";
import { Suspense } from "react";

/**
 * Checkout is the one buying page that shows what could stop a payment (identity, email,
 * address). The strip is empty when there is nothing to fix, so it takes no space until it has
 * something to say.
 */
export default function CheckoutDashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-6">
      <Suspense fallback={null}>
        <DashboardComplianceStrip loginNext="/dashboard/checkout" />
      </Suspense>
      {children}
    </div>
  );
}
