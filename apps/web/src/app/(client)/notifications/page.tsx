import { NotificationsInboxContent } from "@/app/(client)/notifications/notifications-inbox-content";
import { SetMobileShellTitle } from "@/components/layout/set-mobile-shell-title";
import { ListSkeleton } from "@/components/workspace/list-states";
import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import { CLIENT_ROUTES } from "@/lib/navigation/client-routes";
import type { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireAuthenticatedUser({
    shell: "client",
    loginNext: CLIENT_ROUTES.notifications,
  });
  return (
    <>
      <SetMobileShellTitle title="Notifications" />
      <Suspense fallback={<ListSkeleton label="Loading your notifications" rows={4} />}>
        <NotificationsInboxContent
          searchParams={searchParams}
          userId={user.id}
          role={user.role}
          staffRoles={user.staffRoles}
        />
      </Suspense>
    </>
  );
}
