import { NotificationsInboxContent } from "@/app/dashboard/notifications/notifications-inbox-content";
import { DashboardSkeleton } from "@/components/dashboard/primitives/dashboard-skeleton";
import { Suspense } from "react";

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; type?: string }>;
}) {
  return (
    <Suspense fallback={<DashboardSkeleton variant="listWithToolbar" />}>
      <NotificationsInboxContent searchParams={searchParams} />
    </Suspense>
  );
}
