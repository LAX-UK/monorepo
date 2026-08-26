/** Deduplicate client analytics across Strict Mode remounts. */
export function trackOnce(key: string, track: () => void): void {
  if (typeof window === "undefined") return;
  try {
    if (sessionStorage.getItem(key) === "1") return;
    sessionStorage.setItem(key, "1");
  } catch {
    // Fall through and emit when storage is unavailable.
  }
  track();
}
