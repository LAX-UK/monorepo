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

const FINANCE_PATH_PREFIXES = [
  "/admin/v1/refunds",
  "/admin/v1/payouts",
  "/admin/v1/sale-fees",
  "/admin/v1/fulfilment/possession",
  "/admin/v1/cancellations",
] as const;

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
  const isFinanceRoute = FINANCE_PATH_PREFIXES.some((prefix) =>
    normalizedPathname.startsWith(prefix),
  );
  const requiresRecentAuth = input.method.toUpperCase() !== "GET" && isFinanceRoute;
  return {
    upstreamUrl: new URL(upstreamPath, `${input.shopApiBaseUrl}/`),
    requiresRecentAuth,
  };
}
