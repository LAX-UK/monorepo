import { isSafeNextPath } from "@/lib/auth/safe-next-path";
import { ACCOUNT_QUERY_PARAM, CLIENT_ROUTES, isClientAreaPath } from "./client-routes";

/**
 * Links that must open in a given account, and the hops that make that happen. Pages never
 * switch accounts themselves: they send the browser to `/switch-account` or `/restore-account`,
 * the only places (with the switch action and the sign-in callback) that write the
 * acting-account cookie. A hop is always opened as a page, from a server redirect, a form, an
 * email or a plain `<a>`; never by the client router (`<Link>`), which cannot carry the cookie it
 * sets into the layout it keeps. Inside Bid, `useAccountSwitch` is the way to switch.
 */

/** Where a hop goes back to: a same-origin page other than a hop; anything else is Home. */
export function safeHopNext(next: string | null | undefined): string {
  if (!next || !isSafeNextPath(next)) return CLIENT_ROUTES.home;
  const path = next.split(/[?#]/)[0] ?? "";
  return isAccountHop(path) ? CLIENT_ROUTES.home : next;
}

/**
 * The page a person was refused, from `/no-access?next=…`, or `null` when there is none (a
 * bookmark, a stale link): the access page then has nothing to deny and sends them to their Home.
 */
export function refusedPageTarget(next: string | null | undefined): string | null {
  if (!next || !isSafeNextPath(next)) return null;
  const path = next.split(/[?#]/)[0] ?? "";
  return isAccountHop(path) ? null : next;
}

/** The two routes that write the account cookie (not their confirm or retry pages). */
export function isHop(path: string): boolean {
  return path === CLIENT_ROUTES.accountSwitch || path === CLIENT_ROUTES.accountRestore;
}

/** A hop or one of its own pages (confirm, retry): never a place to come back to. */
function isAccountHop(path: string): boolean {
  return [CLIENT_ROUTES.accountSwitch, CLIENT_ROUTES.accountRestore].some(
    (hop) => path === hop || path.startsWith(`${hop}/`),
  );
}

/**
 * The hop that opens `next` in account `accountId`, switching to it when the person may.
 * `openedFrom` is the account a notification was opened from: the notice then offers to switch
 * back to it.
 */
export function switchAccountHref(
  accountId: string,
  next: string,
  openedFrom?: { notificationFrom: string },
): string {
  const params = new URLSearchParams({ to: accountId, next });
  if (openedFrom) params.set(NOTIFICATION_FROM_PARAM, openedFrom.notificationFrom);
  return `${CLIENT_ROUTES.accountSwitch}?${params.toString()}`;
}

/** The switch hop's parameter naming the account a notification was opened from. */
export const NOTIFICATION_FROM_PARAM = "from";

/**
 * Asks before opening `next` in account `accountId`: where a link from another site (an email, a
 * shared message) lands, since only the person may change the account they use.
 */
export function confirmSwitchHref(accountId: string, next: string): string {
  const params = new URLSearchParams({ to: accountId, next });
  return `${CLIENT_ROUTES.accountSwitchConfirm}?${params.toString()}`;
}

/**
 * The retry state for a hop or a record lookup that could not read the person's accounts.
 * `retry` is where "Try again" goes: the same hop, or the page that was being opened.
 */
export function accountsUnavailableHref(retry: string): string {
  return `${CLIENT_ROUTES.accountsUnavailable}?${new URLSearchParams({ retry }).toString()}`;
}

/** Where "Try again" on the retry state may go: a hop, or a page `safeHopNext` allows. */
export function safeRetryTarget(retry: string | null | undefined): string {
  if (!retry || !isSafeNextPath(retry)) return CLIENT_ROUTES.home;
  return isHop(retry.split(/[?#]/)[0] ?? "") ? retry : safeHopNext(retry);
}

/** The hop that puts this browser back in the account the person used last. */
export function restoreAccountHref(next: string): string {
  return `${CLIENT_ROUTES.accountRestore}?${new URLSearchParams({ next }).toString()}`;
}

/**
 * A client-area link carrying `?account=<id>` (old organisation links, links from emails) goes
 * through the switch hop, which drops the parameter so the address stays clean. `null` when the
 * URL needs nothing.
 */
export function accountLinkRedirect(url: Pick<URL, "pathname" | "search" | "hash">): string | null {
  const target = accountLinkTarget(url);
  return target ? switchAccountHref(target.accountId, target.next) : null;
}

/** The account a client-area link names and the page it opens there, or `null` for a plain link. */
export function accountLinkTarget(
  url: Pick<URL, "pathname" | "search" | "hash">,
): { accountId: string; next: string } | null {
  if (!isClientAreaPath(url.pathname) || isAccountHop(url.pathname)) return null;
  const params = new URLSearchParams(url.search);
  const accountId = params.get(ACCOUNT_QUERY_PARAM);
  if (!accountId) return null;
  params.delete(ACCOUNT_QUERY_PARAM);
  const rest = params.toString();
  return { accountId, next: `${url.pathname}${rest ? `?${rest}` : ""}${url.hash}` };
}
