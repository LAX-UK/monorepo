import { isSafeNextPath } from "@/lib/auth/safe-next-path";
import { ACCOUNT_QUERY_PARAM, CLIENT_ROUTES, isClientAreaPath } from "./client-routes";

/**
 * Links that must open in a given account, and the hops that make that happen. Pages never
 * switch accounts themselves: they send the browser to `/switch-account` or `/restore-account`,
 * the only places (with the switch action) that write the acting-account cookie.
 */

/** Where a hop goes back to: a same-origin page other than a hop; anything else is Home. */
export function safeHopNext(next: string | null | undefined): string {
  if (!next || !isSafeNextPath(next)) return CLIENT_ROUTES.home;
  const path = next.split(/[?#]/)[0] ?? "";
  return isAccountHop(path) ? CLIENT_ROUTES.home : next;
}

function isAccountHop(path: string): boolean {
  return path === CLIENT_ROUTES.accountSwitch || path === CLIENT_ROUTES.accountRestore;
}

/** The hop that opens `next` in account `accountId`, switching to it when the person may. */
export function switchAccountHref(accountId: string, next: string): string {
  const params = new URLSearchParams({ to: accountId, next });
  return `${CLIENT_ROUTES.accountSwitch}?${params.toString()}`;
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
  if (!isClientAreaPath(url.pathname) || isAccountHop(url.pathname)) return null;
  const params = new URLSearchParams(url.search);
  const accountId = params.get(ACCOUNT_QUERY_PARAM);
  if (!accountId) return null;
  params.delete(ACCOUNT_QUERY_PARAM);
  const rest = params.toString();
  const next = `${url.pathname}${rest ? `?${rest}` : ""}${url.hash}`;
  return switchAccountHref(accountId, next);
}
