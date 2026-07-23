import type { AdminFilterPreserved } from "@/lib/admin/filters/types";

/** Merge current URL params with draft patches; empty values remove keys; always resets offset. */
export function mergeFilterSearchParams(
  current: URLSearchParams,
  patch: Record<string, string | boolean | undefined | null>,
  preserved: AdminFilterPreserved,
): URLSearchParams {
  const next = new URLSearchParams(current.toString());
  for (const [key, value] of Object.entries(preserved)) {
    if (value != null && value !== "") next.set(key, value);
    else next.delete(key);
  }
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    if (value === null || value === "" || value === false) {
      next.delete(key);
      continue;
    }
    if (value === true) next.set(key, "1");
    else next.set(key, value);
  }
  next.set("offset", "0");
  return next;
}

export function hrefFromSearchParams(pathname: string, params: URLSearchParams): string {
  const qs = params.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}
