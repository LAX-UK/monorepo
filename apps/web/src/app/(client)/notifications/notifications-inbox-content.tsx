import { NotificationsInboxBoard } from "@/components/dashboard/notifications-inbox-board";
import type { InboxTab } from "@/components/dashboard/notifications/inbox-tab";
import { NOTIFICATIONS_PAGE_SIZE } from "@/components/dashboard/notifications/notifications-inbox.constants";
import { getServerDataContainer } from "@/lib/data/container.server";

function parseTab(raw: string | undefined): InboxTab {
  if (raw === "unread" || raw === "archived") return raw;
  return "all";
}

/** Loads notification data inside a parent `<Suspense>` so route `loading.tsx` can render. */
export async function NotificationsInboxContent({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; type?: string }>;
}) {
  const sp = await searchParams;
  const tab = parseTab(sp.tab);
  const type = (sp.type ?? "").trim();
  const c = await getServerDataContainer();
  let items: Awaited<ReturnType<typeof c.notifications.listMine>> = [];
  let loadFailure = false;
  try {
    items = await c.notifications.listMine({
      tab,
      limit: NOTIFICATIONS_PAGE_SIZE,
      offset: 0,
      ...(type ? { type } : {}),
    });
  } catch {
    loadFailure = true;
  }
  const hasMore = !loadFailure && items.length === NOTIFICATIONS_PAGE_SIZE;

  return (
    <NotificationsInboxBoard
      loadFailure={loadFailure}
      {...(loadFailure
        ? {}
        : {
            initialPage: {
              tab,
              type,
              items,
              hasMore,
            },
          })}
    />
  );
}
