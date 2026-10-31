import { NotificationsInboxBoard } from "@/components/dashboard/notifications-inbox-board";
import { NOTIFICATIONS_PAGE_SIZE } from "@/components/dashboard/notifications/notifications-inbox.constants";
import {
  getServerInboxCounts,
  getServerInboxPage,
  getServerNotificationMutes,
} from "@/lib/data/http/notifications-inbox.server";
import { resolveActingContext } from "@/lib/legal-entity/acting-context.server";
import { parseInboxQuery } from "@/lib/notifications/inbox-query";
import { organisationStatePolicy } from "@auction/domain";

type SearchParams = Record<string, string | string[] | undefined>;

/** Loads the inbox inside a parent `<Suspense>` so the route's loading state can render. */
export async function NotificationsInboxContent({
  searchParams,
  role,
  staffRoles,
}: {
  searchParams: Promise<SearchParams>;
  role: Parameters<typeof resolveActingContext>[0];
  staffRoles: Parameters<typeof resolveActingContext>[1];
}) {
  const query = parseInboxQuery(await searchParams);
  const [page, counts, mutes, { acting }] = await Promise.all([
    getServerInboxPage(query, NOTIFICATIONS_PAGE_SIZE).catch(() => null),
    getServerInboxCounts(query.account),
    getServerNotificationMutes(),
    resolveActingContext(role, staffRoles),
  ]);
  // A paused organisation still gets its notifications; the page says so.
  const paused =
    acting.kind === "organisation" &&
    organisationStatePolicy(acting.status, new Set()).banner?.kind === "blocked"
      ? acting.displayName
      : null;

  return (
    <NotificationsInboxBoard
      query={query}
      initialPage={
        page ? { query, items: page, hasMore: page.length === NOTIFICATIONS_PAGE_SIZE } : null
      }
      counts={counts}
      mutedIds={(mutes ?? []).map((m) => m.legalEntityId)}
      paused={paused}
    />
  );
}
