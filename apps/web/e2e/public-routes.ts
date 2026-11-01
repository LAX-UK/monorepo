import type { APIRequestContext } from "@playwright/test";

/** One page of the public site that the visual and accessibility specs open. */
export type PublicRoute = { name: string; path: string };

export const STATIC_PUBLIC_ROUTES: readonly PublicRoute[] = [
  { name: "home", path: "/" },
  { name: "calendar-live", path: "/sales?tab=live" },
  { name: "calendar-upcoming", path: "/sales?tab=upcoming" },
  { name: "calendar-results", path: "/sales?tab=results" },
  { name: "search", path: "/search" },
  { name: "search-none", path: "/search?q=zzzzqxj" },
  { name: "archive", path: "/archive" },
  { name: "contact", path: "/contact" },
  { name: "press", path: "/press" },
  { name: "artists", path: "/artists" },
  { name: "not-found", path: "/this-page-does-not-exist" },
  { name: "lot-not-found", path: "/lot/missing/00000000-0000-4000-8000-000000000000" },
];

type SaleRow = { sale: { id: string; status: string; deliveryMode: string } };
type LotRow = { id: string; status: string };

const apiBase = () =>
  process.env.PLAYWRIGHT_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

async function listJson<T>(request: APIRequestContext, path: string): Promise<T[]> {
  const res = await request.get(`${apiBase()}${path}`);
  if (!res.ok()) return [];
  const body = (await res.json()) as { data?: T[] };
  return body.data ?? [];
}

/** The first sale that satisfies each rule, so the list follows whatever the stack is seeded with. */
export async function resolveSaleRoutes(request: APIRequestContext): Promise<PublicRoute[]> {
  const sales = await listJson<SaleRow>(request, "/sales?limit=50");
  const pick = (name: string, match: (s: SaleRow["sale"]) => boolean): PublicRoute[] => {
    const found = sales.find((row) => match(row.sale));
    return found ? [{ name, path: `/sales/sale/${found.sale.id}` }] : [];
  };
  return [
    ...pick("sale-timed", (s) => s.status === "active" && s.deliveryMode === "online"),
    ...pick("sale-hybrid", (s) => s.deliveryMode === "hybrid" || s.deliveryMode === "onsite"),
    ...pick("sale-ended", (s) => s.status === "closed" || s.status === "ended"),
  ];
}

export async function resolveLotRoutes(request: APIRequestContext): Promise<PublicRoute[]> {
  const lots = await listJson<LotRow>(request, "/lots?limit=50");
  const pick = (name: string, status: string): PublicRoute[] => {
    const found = lots.find((lot) => lot.status === status);
    return found ? [{ name, path: `/lot/lot/${found.id}` }] : [];
  };
  return [...pick("lot-live", "active"), ...pick("lot-sold", "sold")];
}

export async function resolvePublicRoutes(request: APIRequestContext): Promise<PublicRoute[]> {
  const [sales, lots] = await Promise.all([resolveSaleRoutes(request), resolveLotRoutes(request)]);
  return [...STATIC_PUBLIC_ROUTES, ...sales, ...lots];
}
