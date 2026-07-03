import { browserApiBase, browserFetch } from "@/lib/data/http/hc-browser";

/** Credentialed JSON GET for admin/command palette search sources. */
export async function paletteJsonFetch<T>(
  path: string,
  params: URLSearchParams,
): Promise<T | null> {
  const qs = params.toString();
  const url = `${browserApiBase()}${path}${qs ? `?${qs}` : ""}`;
  const res = await browserFetch(url, { cache: "no-store" });
  if (!res.ok) return null;
  return (await res.json()) as T;
}

/** Credentialed JSON GET without query string (e.g. flat list endpoints). */
export async function paletteJsonFetchPath<T>(path: string): Promise<T | null> {
  const res = await browserFetch(`${browserApiBase()}${path}`, { cache: "no-store" });
  if (!res.ok) return null;
  return (await res.json()) as T;
}
