const PREFIX = "lot-cr-dismissed";

export function conditionReportDismissKey(userId: string | null, lotId: string): string {
  return `${PREFIX}:${userId ?? "anon"}:${lotId}`;
}

export function isConditionReportDismissed(userId: string | null, lotId: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(conditionReportDismissKey(userId, lotId)) === "1";
  } catch {
    return false;
  }
}

export function setConditionReportDismissed(
  userId: string | null,
  lotId: string,
  dismissed: boolean,
): void {
  if (typeof window === "undefined") return;
  try {
    const key = conditionReportDismissKey(userId, lotId);
    if (dismissed) window.localStorage.setItem(key, "1");
    else window.localStorage.removeItem(key);
  } catch {
    /* storage unavailable */
  }
}
