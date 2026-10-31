import { CLIENT_ROUTES } from "@/lib/navigation/client-routes";

/**
 * The Notifications page's address: the view, a type, an account and words. Each view has its own
 * address; Needs action is the page itself, because what asks for something comes first.
 */
export const INBOX_TABS = ["needs_action", "all", "unread", "archived"] as const;
export type InboxTab = (typeof INBOX_TABS)[number];

export const INBOX_TAB_LABEL: Record<InboxTab, string> = {
  needs_action: "Needs action",
  all: "All",
  unread: "Unread",
  archived: "Archived",
};

const DEFAULT_TAB: InboxTab = "needs_action";

/** `all`: every account; `personal`: the person's own; otherwise an organisation's id. */
export type InboxAccount = "all" | "personal" | (string & {});

export type InboxQuery = {
  tab: InboxTab;
  /** A type group from {@link NOTIFICATION_TYPES}; empty for every type. */
  type: string;
  account: InboxAccount;
  q: string;
};

/** The type groups the Filter offers (the API widens each to its notice types). */
export const NOTIFICATION_TYPES: readonly { id: string; label: string }[] = [
  { id: "outbid", label: "Outbid" },
  { id: "lot_won", label: "Won" },
  { id: "lot_lost", label: "Not won" },
  { id: "payments", label: "Payments" },
  { id: "fulfilment", label: "Delivery" },
  { id: "closing_soon", label: "Closing soon" },
  { id: "watching", label: "Watching" },
  { id: "consignments", label: "Consignments" },
  { id: "team", label: "Team and access" },
];

const TYPE_IDS = new Set(NOTIFICATION_TYPES.map((t) => t.id));
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_Q = 100;

type RawParams = Record<string, string | string[] | undefined>;

function first(raw: string | string[] | undefined): string {
  return (Array.isArray(raw) ? raw[0] : raw)?.trim() ?? "";
}

export function parseInboxTab(raw: string | null | undefined): InboxTab {
  return (INBOX_TABS as readonly string[]).includes(raw ?? "") ? (raw as InboxTab) : DEFAULT_TAB;
}

function parseAccount(raw: string): InboxAccount {
  if (raw === "personal") return "personal";
  return UUID.test(raw) ? raw : "all";
}

/** The query from the page's search params; anything unknown falls back to the default. */
export function parseInboxQuery(params: RawParams): InboxQuery {
  const type = first(params.type);
  return {
    tab: parseInboxTab(first(params.tab)),
    type: TYPE_IDS.has(type) ? type : "",
    account: parseAccount(first(params.account)),
    q: first(params.q).slice(0, MAX_Q),
  };
}

/** The page's address for a query, leaving defaults out so addresses stay short. */
export function inboxHref(query: InboxQuery): string {
  return `${CLIENT_ROUTES.notifications}${inboxSearch(query)}`;
}

/** `?tab=all&q=arles`, or "" for the default view. */
export function inboxSearch(query: InboxQuery): string {
  const params = new URLSearchParams();
  if (query.tab !== DEFAULT_TAB) params.set("tab", query.tab);
  if (query.type) params.set("type", query.type);
  if (query.account !== "all") params.set("account", query.account);
  if (query.q) params.set("q", query.q);
  const s = params.toString();
  return s ? `?${s}` : "";
}

/** The API's query string for one page of the list. */
export function inboxApiParams(query: InboxQuery, offset: number, limit: number): URLSearchParams {
  const params = new URLSearchParams({
    tab: query.tab,
    limit: String(limit),
    offset: String(offset),
  });
  if (query.type) params.set("type", query.type);
  if (query.account !== "all") params.set("account", query.account);
  if (query.q) params.set("q", query.q);
  return params;
}

/** A search, type or account narrows the list, so an empty view means "no results". */
export function inboxNarrowed(query: InboxQuery): boolean {
  return Boolean(query.q || query.type || query.account !== "all");
}

/** The same view, with the search, type and account cleared. */
export function inboxCleared(query: InboxQuery): InboxQuery {
  return { tab: query.tab, type: "", account: "all", q: "" };
}

export function inboxTypeLabel(type: string): string | null {
  return NOTIFICATION_TYPES.find((t) => t.id === type)?.label ?? null;
}
