import { TelephoneBidsPageContent } from "@/app/dashboard/telephone-bids/telephone-bids-page-content";
import { DashboardListPage } from "@/components/dashboard/dashboard-list-page";
import { DashboardSkeleton } from "@/components/dashboard/primitives/dashboard-skeleton";
import { readClientWorkspacePageMeta } from "@/lib/workspace/client-workspace-mode";
import { Suspense } from "react";

export default async function DashboardTelephoneBidsPage() {
  const workspaceMeta = await readClientWorkspacePageMeta();

  return (
    <DashboardListPage
      meta={workspaceMeta}
      title="Telephone bids"
      description="Track live telephone line bookings for onsite sales and request limit increases."
    >
      <Suspense fallback={<DashboardSkeleton variant="list" />}>
        <TelephoneBidsPageContent />
      </Suspense>
    </DashboardListPage>
  );
}
