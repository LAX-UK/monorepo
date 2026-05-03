import { NotificationsFeedView } from "@/components/dashboard/notifications-feed-view";
import { NotificationsInboxBoard } from "@/components/dashboard/notifications-inbox-board";

type PageProps = {
  searchParams: Promise<{ view?: string }>;
};

export default async function NotificationsPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const view = (sp.view ?? "").toLowerCase();
  if (view === "inbox") {
    return <NotificationsInboxBoard />;
  }
  return <NotificationsFeedView />;
}
