import { NotificationsInboxContent } from "@/app/dashboard/notifications/notifications-inbox-content";
import { DashboardListPage } from "@/components/dashboard/dashboard-list-page";
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
    <DashboardListPage
      meta={workspaceMeta}
      title="Notifications"
      description="Bids, wins, payments, and saved-lot updates. Live when you are online."
    >
      <Suspense fallback={<DashboardSkeleton variant="listWithToolbar" />}>
        <NotificationsInboxContent searchParams={searchParams} />
      </Suspense>
    </DashboardListPage>
  );
}
