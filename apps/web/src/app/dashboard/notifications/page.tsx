import { NotificationsInboxBoard } from "@/components/dashboard/notifications-inbox-board";

// Single, unified notifications surface. Tab (`?tab=`) and type (`?type=`)
// query params drive state and remain shareable. Legacy `?view=feed` links
// land here too — the extra param is ignored.
export default function NotificationsPage() {
  return <NotificationsInboxBoard />;
}
