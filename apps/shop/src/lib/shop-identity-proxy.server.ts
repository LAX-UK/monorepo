import { cookies } from "next/headers";

/** Same-origin proxy so Shop Identity Set-Cookie reaches the browser. */
export function shopIdentityProxyUrl(path: string): string {
  const normalized = path.startsWith("/") ? path.slice(1) : path;
  return `/api/shop-identity/${normalized}`;
}

export async function shopIdentityProxyCookieHeader(): Promise<string | undefined> {
  const store = await cookies();
  const filtered = store.getAll();
  if (filtered.length === 0) return undefined;
  return filtered.map((entry) => `${entry.name}=${entry.value}`).join("; ");
}
