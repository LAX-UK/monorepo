import { type AccountContext, accountHomePathForKind } from "./account-home";
import { CLIENT_ROUTES, isClientAreaPath } from "./client-routes";
import { pathOf } from "./path-of";

/**
 * Where a person lands after switching account. A page that exists for both kinds of account
 * stays open, so switching changes whose Bids or Purchases are shown, not which page. Any other
 * page (an organisation's Team, a record that belongs to one account) opens the new account's
 * first page.
 *
 * Public pages (a lot, a sale, an artist) are the same for every account and stay as they are,
 * query included.
 *
 * The table lists the pages that exist for both. A new shared page is one more row, so no
 * component decides this for itself. Only list pages are listed: a page under one, such as a
 * single purchase, belongs to the account it was opened in.
 */
const PAGES_IN_BOTH_ACCOUNTS: ReadonlySet<string> = new Set([
  CLIENT_ROUTES.bids,
  CLIENT_ROUTES.purchases,
  CLIENT_ROUTES.watching,
  CLIENT_ROUTES.notifications,
  CLIENT_ROUTES.settings,
  CLIENT_ROUTES.selling,
]);

/**
 * Pages of the sign-in and onboarding tasks. They are not the client area, but they are not the
 * public site either: each belongs to the person doing the task, so a switch opens the account's
 * first page instead of staying.
 */
const TASK_PAGE_PREFIXES = [
  "/auth",
  "/forgot-password",
  "/invitations",
  "/login",
  "/onboarding",
  "/register",
  "/reset-password",
  "/verify-email",
] as const;

function isTaskPage(path: string): boolean {
  const pathname = pathOf(path);
  return TASK_PAGE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function withoutTrailingSlash(path: string): string {
  return pathOf(path).replace(/\/+$/, "");
}

/** Whether this page (a path, with or without a query) exists for personal and organisation accounts. */
export function existsInBothAccounts(path: string): boolean {
  return PAGES_IN_BOTH_ACCOUNTS.has(withoutTrailingSlash(path));
}

/**
 * The page to open after switching to an account of `target` kind, from `currentPath`. The query
 * is dropped on purpose: filters and tabs name things of the account just left.
 */
export function pageAfterSwitch(
  currentPath: string | null,
  target: AccountContext["kind"],
): string {
  if (currentPath && !isClientAreaPath(pathOf(currentPath)) && !isTaskPage(currentPath)) {
    return currentPath;
  }
  if (currentPath && existsInBothAccounts(currentPath)) return withoutTrailingSlash(currentPath);
  return accountHomePathForKind(target);
}
