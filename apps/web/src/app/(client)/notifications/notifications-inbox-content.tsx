import { NotificationsInboxBoard } from "@/components/dashboard/notifications-inbox-board";
import { NOTIFICATIONS_PAGE_SIZE } from "@/components/dashboard/notifications/notifications-inbox.constants";
import { initials } from "@/components/organisations/initials";
import { getServerNeedsYou } from "@/lib/data/http/needs-you.server";
import {
  getServerInboxCounts,
  getServerInboxPage,
  getServerNotificationMutes,
} from "@/lib/data/http/notifications-inbox.server";
import { resolveActingContext } from "@/lib/legal-entity/acting-context.server";
import { parseInboxQuery } from "@/lib/notifications/inbox-query";
import { type NeedsActionView, needsActionRows } from "@/lib/notifications/needs-action";
import { personalNeedsAction } from "@/lib/notifications/personal-needs-action";
import { loadPurchaseSources } from "@/lib/purchases/purchase-sources.server";
import { buildPurchasesVm } from "@/lib/purchases/purchases.vm";
import { organisationStatePolicy } from "@auction/domain";

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * The person's own Needs action: money first, then everything else the Needs-you reader lists for
 * them. A read that fails is said, never shown as "nothing needs you".
 */
async function loadPersonalNeedsAction(acting: {
  id: string;
  displayName: string;
  role: Parameters<typeof personalNeedsAction>[0]["ctx"]["actor"]["role"];
}): Promise<Pick<NeedsActionView, "rows" | "failed">> {
  try {
    const [sources, response] = await Promise.all([
      loadPurchaseSources(),
      getServerNeedsYou(acting.id),
    ]);
    if (!sources || !response) return { rows: [], failed: true };
    return personalNeedsAction({
      purchases: buildPurchasesVm(sources),
      response,
      ctx: { name: acting.displayName, now: new Date(), actor: { role: acting.role } },
    });
  } catch {
    return { rows: [], failed: true };
  }
}

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
  // An organisation's Needs action is the one reader's answer, shared with Home and the menu. A
  // person's own is driven by money: what Purchases shows is owed, waiting or on hold.
  const needsAction: NeedsActionView =
    acting.kind === "organisation"
      ? {
          account: {
            kind: "organisation",
            name: acting.displayName,
            initials: initials(acting.displayName),
          },
          ...needsActionRows(await getServerNeedsYou(acting.id), {
            organisationName: acting.displayName,
            now: new Date(),
            actor: { role: acting.role, isImpersonation: acting.isImpersonation },
          }),
        }
      : {
          account: {
            kind: "personal",
            name: acting.displayName,
            initials: initials(acting.displayName),
          },
          ...(await loadPersonalNeedsAction(acting)),
        };
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
      needsAction={needsAction}
    />
  );
}
