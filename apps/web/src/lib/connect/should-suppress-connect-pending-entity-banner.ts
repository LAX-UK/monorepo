import { DASHBOARD_ROUTES } from "@/lib/dashboard/dashboard-copy";

/** Hide global connect_pending entity banner when user is already on payout setup. */
export function shouldSuppressConnectPendingEntityBanner(pathname: string): boolean {
  const connect = DASHBOARD_ROUTES.sellerConnect;
  return pathname === connect || pathname.startsWith(`${connect}/`);
}
