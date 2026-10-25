import { isStepUpPath } from "@auction/shop-contracts";

export type AdminProxyRule = {
  /** BFF path prefix without trailing slash, e.g. /api/admin */
  bffPrefix: string;
  /** Upstream admin path prefix */
  upstreamPrefix: string;
  requiresRecentAuth: boolean;
};

export const ADMIN_PROXY_RULES: readonly AdminProxyRule[] = [
  { bffPrefix: "/api/admin", upstreamPrefix: "/admin/v1", requiresRecentAuth: false },
];

function segmentIsUnsafe(segment: string): boolean {
  if (segment === ".." || segment === ".") {
    return true;
  }
  let decoded = segment;
  for (let pass = 0; pass < 3; pass += 1) {
    if (decoded === ".." || decoded === ".") {
      return true;
    }
    const normalized = decoded.toLowerCase();
    if (normalized === "%2e" || normalized === "%2e%2e") {
      return true;
    }
    try {
      const next = decodeURIComponent(decoded);
      if (next === decoded) {
        break;
      }
      decoded = next;
    } catch {
      return true;
    }
  }
  return decoded === ".." || decoded === ".";
}

function hasUnsafePathSegment(suffix: string): boolean {
  for (const segment of suffix.split("/").filter((part) => part.length > 0)) {
    if (segmentIsUnsafe(segment)) {
      return true;
    }
  }
  return false;
}

export function resolveAdminProxyTarget(input: {
  bffPath: string;
  shopApiBaseUrl: string;
  method: string;
  /** The request's query string, with or without the leading "?". Forwarded as it came. */
  search?: string;
}): { upstreamUrl: URL; requiresRecentAuth: boolean } | null {
  const rule = ADMIN_PROXY_RULES[0];
  if (!rule || !input.bffPath.startsWith(`${rule.bffPrefix}/`)) {
    return null;
  }
  const suffix = input.bffPath.slice(rule.bffPrefix.length);
  if (hasUnsafePathSegment(suffix)) {
    return null;
  }
  const upstreamPath = `${rule.upstreamPrefix}${suffix}`;
  const normalizedPathname = new URL(upstreamPath, "http://admin.local").pathname;
  // Mutations on the shared list (money, access, selling rights) need a recent sign-in; shop-api
  // checks the same list, see SHOP_ADMIN_STEP_UP_PATHS.
  const requiresRecentAuth =
    input.method.toUpperCase() !== "GET" && isStepUpPath(normalizedPathname);
  const upstreamUrl = new URL(upstreamPath, `${input.shopApiBaseUrl}/`);
  const search = input.search?.replace(/^\?/, "");
  if (search) upstreamUrl.search = search;
  return {
    upstreamUrl,
    requiresRecentAuth,
  };
}
