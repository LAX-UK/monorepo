import { NotificationsInboxContent } from "@/app/dashboard/notifications/notifications-inbox-content";
import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { DashboardPageHeader } from "@/components/dashboard/primitives/dashboard-page-header";
import { DashboardSkeleton } from "@/components/dashboard/primitives/dashboard-skeleton";
import { readClientWorkspacePageMeta } from "@/lib/workspace/client-workspace-mode";
import { Suspense } from "react";

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; type?: string }>;
}) {
  const workspaceMeta = await readClientWorkspacePageMeta();

  return (
    <DashboardPage>
      <DashboardPageHeader
        meta={workspaceMeta}
        title="Notifications"
        hideTitleOnMobile
        hideDescriptionOnMobile
        description="Bids, wins, payments, and saved-lot updates. Live when you are online."
      />
      <Suspense fallback={<DashboardSkeleton variant="listWithToolbar" />}>
        <NotificationsInboxContent searchParams={searchParams} />
      </Suspense>
    </DashboardPage>
  );
}
