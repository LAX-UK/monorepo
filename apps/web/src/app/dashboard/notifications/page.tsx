import { NotificationsInboxBoard } from "@/components/dashboard/notifications-inbox-board";
import type { InboxTab } from "@/components/dashboard/notifications/inbox-tab";
import { NOTIFICATIONS_PAGE_SIZE } from "@/components/dashboard/notifications/notifications-inbox.constants";
import { getServerDataContainer } from "@/lib/data/container.server";
import { PageSkeleton } from "@auction/ui/components/page-skeleton";
import { Suspense } from "react";

function parseTab(raw: string | undefined): InboxTab {
  if (raw === "unread" || raw === "archived") return raw;
  return "all";
}

async function NotificationsInboxContent({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; type?: string }>;
}) {
  const sp = await searchParams;
  const tab = parseTab(sp.tab);
  const type = (sp.type ?? "").trim();
  const c = await getServerDataContainer();
  const items = await c.notifications.listMine({
    tab,
    limit: NOTIFICATIONS_PAGE_SIZE,
    offset: 0,
    ...(type ? { type } : {}),
  });
  const hasMore = items.length === NOTIFICATIONS_PAGE_SIZE;
  return (
    <NotificationsInboxBoard
      initialPage={{
        tab,
        type,
        items,
        hasMore,
      }}
    />
  );
}

export default function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; type?: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-5xl px-4 py-10">
          <PageSkeleton variant="table" />
        </div>
      }
    >
      <NotificationsInboxContent searchParams={searchParams} />
    </Suspense>
  );
}
