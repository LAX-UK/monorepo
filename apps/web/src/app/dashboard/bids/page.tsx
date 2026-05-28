import { BidsPageContent } from "@/app/dashboard/bids/bids-page-content";
import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { DashboardPageHeader } from "@/components/dashboard/primitives/dashboard-page-header";
import { DashboardSkeleton } from "@/components/dashboard/primitives/dashboard-skeleton";
import { readClientWorkspacePageMeta } from "@/lib/workspace/client-workspace-mode";
import { Suspense } from "react";

type PageProps = {
  searchParams: Promise<{ tab?: string; q?: string }>;
};

export default async function DashboardBidsPage({ searchParams }: PageProps) {
  const workspaceMeta = await readClientWorkspacePageMeta();

  return (
    <DashboardPage>
      <DashboardPageHeader
        meta={workspaceMeta}
        title="My Bids"
        hideTitleOnMobile
        hideDescriptionOnMobile
        description="Track active, won, and lost lots with your latest bid values."
      />
      <Suspense fallback={<DashboardSkeleton variant="list" />}>
        <BidsPageContent searchParams={searchParams} />
      </Suspense>
    </DashboardPage>
  );
}
