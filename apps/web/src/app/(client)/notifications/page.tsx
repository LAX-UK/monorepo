import { NotificationsInboxContent } from "@/app/(client)/notifications/notifications-inbox-content";
import { AccountPageLoading } from "@/components/dashboard/primitives/account-page-loading";
import type { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; type?: string }>;
}) {
  return (
    <Suspense
      fallback={<AccountPageLoading title="Notifications" label="Loading your notifications" />}
    >
      <NotificationsInboxContent searchParams={searchParams} />
    </Suspense>
  );
}
