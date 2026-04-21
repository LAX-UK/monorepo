/**
 * Emergency rollback: set `NEXT_PUBLIC_DASHBOARD_V2=0` to disable v2-only UI branches.
 * Default: enabled when unset.
 */
export function isDashboardV2Enabled(): boolean {
  const v = process.env.NEXT_PUBLIC_DASHBOARD_V2;
  if (v === "0" || v === "false") return false;
  return true;
}
