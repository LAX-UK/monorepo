export const ADMIN_HOME_PATH = "/admin";

export function isAdminPath(pathname: string | null | undefined): pathname is string {
  return pathname === ADMIN_HOME_PATH || Boolean(pathname?.startsWith(`${ADMIN_HOME_PATH}/`));
}
