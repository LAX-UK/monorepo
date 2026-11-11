import { isSafeNextPath } from "@/lib/auth/safe-next-path";
import { ADMIN_HOME_PATH, isAdminPath } from "@/lib/navigation/admin-path";

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
