import { isSafeNextPath } from "@/lib/auth/safe-next-path";

export const ADMIN_HOME_PATH = "/admin";

export function isAdminPath(pathname: string | null | undefined): pathname is string {
  return pathname === ADMIN_HOME_PATH || Boolean(pathname?.startsWith(`${ADMIN_HOME_PATH}/`));
}

/**
 * Where staff land after signing in again: the admin page they were on, with its filters, or the
 * admin home when the request path is unknown or unsafe.
 */
export function adminReturnPath(
  pathname: string | null | undefined,
  search?: string | null,
): string {
  if (!isAdminPath(pathname)) return ADMIN_HOME_PATH;
  const candidate = `${pathname}${search?.startsWith("?") ? search : ""}`;
  return isSafeNextPath(candidate) ? candidate : ADMIN_HOME_PATH;
}
