import { DashboardComplianceStrip } from "@/components/dashboard/dashboard-compliance-strip";
import { Suspense } from "react";

/**
 * What could stop a payment (identity, email, address), shown on checkout to the person who
 * pays. It is empty when there is nothing to fix, so it takes no space until it has something
 * to say. A member whose organisation pays for their win has nothing to fix, so never sees it.
 */
export function CheckoutReadinessStrip() {
  return (
    <Suspense fallback={null}>
      <DashboardComplianceStrip loginNext="/purchases/checkout" />
    </Suspense>
  );
}
