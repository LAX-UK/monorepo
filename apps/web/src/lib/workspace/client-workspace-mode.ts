export const CLIENT_WORKSPACE_COOKIE = "lax_client_workspace";

/** Buying (collector) vs Selling & Artist workspace — persisted for signed-in clients. */
export type ClientWorkspaceMode = "buying" | "selling";

export function parseClientWorkspaceMode(raw: string | undefined): ClientWorkspaceMode {
  return raw === "selling" ? "selling" : "buying";
}

const SELLING_PATH_PREFIXES = ["/dashboard/seller", "/dashboard/submissions"] as const;

const BUYING_PATH_PREFIXES = [
  "/dashboard/bids",
  "/dashboard/telephone-bids",
  "/dashboard/portfolio",
  "/dashboard/payments",
  "/dashboard/watchlist",
  "/dashboard/artist-follow",
  "/dashboard/checkout",
] as const;

/** Routes that imply the selling workspace (sidebar + mobile tabs). */
export function isClientSellingPath(pathname: string): boolean {
  return SELLING_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/** Routes that imply the buying workspace. Overview `/dashboard` is neutral (uses cookie). */
export function isClientBuyingPath(pathname: string): boolean {
  if (pathname === "/dashboard") return false;
  return BUYING_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/** Effective workspace for nav chrome — path overrides cookie on mode-specific routes. */
export function resolveClientWorkspaceMode(
  pathname: string,
  cookieMode: ClientWorkspaceMode,
): ClientWorkspaceMode {
  if (isClientSellingPath(pathname)) return "selling";
  if (isClientBuyingPath(pathname)) return "buying";
  return cookieMode;
}

export const CLIENT_WORKSPACE_COOKIE_OPTIONS = {
  path: "/",
  maxAge: 60 * 60 * 24 * 365,
  sameSite: "lax" as const,
  httpOnly: false,
};

/**
 * Dashboard meta conventions:
 * - List pages → `clientWorkspacePageMeta()` → Buying / Selling
 * - Overview → `clientWorkspaceOverviewMeta()` → Collector home / Seller home
 * - Settings / invitations / orgs → domain-specific meta (unchanged)
 */

/** Dashboard page header eyebrow for task list pages in the active client workspace. */
export function clientWorkspacePageMeta(mode: ClientWorkspaceMode): string {
  return mode === "selling" ? "Selling" : "Buying";
}

/** Overview home eyebrow — welcoming, mode-aware label (not Buying/Selling). */
export function clientWorkspaceOverviewMeta(mode: ClientWorkspaceMode): string {
  return mode === "selling" ? "Seller home" : "Collector home";
}

/** Read persisted workspace mode from cookies and return the list-page header eyebrow. */
export async function readClientWorkspacePageMeta(): Promise<string> {
  const { cookies } = await import("next/headers");
  const jar = await cookies();
  return clientWorkspacePageMeta(parseClientWorkspaceMode(jar.get(CLIENT_WORKSPACE_COOKIE)?.value));
}

/** Read persisted workspace mode from cookies and return the overview home eyebrow. */
export async function readClientWorkspaceOverviewMeta(): Promise<string> {
  const { cookies } = await import("next/headers");
  const jar = await cookies();
  return clientWorkspaceOverviewMeta(
    parseClientWorkspaceMode(jar.get(CLIENT_WORKSPACE_COOKIE)?.value),
  );
}
