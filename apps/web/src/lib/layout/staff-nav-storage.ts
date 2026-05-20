const OPEN_PREFIX = "lax.staffNav.open.";

export function staffNavGroupStorageKey(groupId: string): string {
  return `${OPEN_PREFIX}${groupId}`;
}

export function readStaffNavGroupOpen(groupId: string): boolean | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(staffNavGroupStorageKey(groupId));
    if (raw === null) return null;
    return raw === "1";
  } catch {
    return null;
  }
}

export function writeStaffNavGroupOpen(groupId: string, open: boolean): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(staffNavGroupStorageKey(groupId), open ? "1" : "0");
  } catch {
    /* ignore */
  }
}
