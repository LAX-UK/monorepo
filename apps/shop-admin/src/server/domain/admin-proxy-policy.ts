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
] as const;

export function resolveAdminProxyTarget(input: {
  bffPath: string;
  shopApiBaseUrl: string;
}): { upstreamUrl: URL; requiresRecentAuth: boolean } | null {
  const rule = ADMIN_PROXY_RULES[0];
  if (!rule || !input.bffPath.startsWith(`${rule.bffPrefix}/`)) {
    return null;
  }
  const suffix = input.bffPath.slice(rule.bffPrefix.length);
  const upstreamPath = `${rule.upstreamPrefix}${suffix}`;
  const requiresRecentAuth = FINANCE_PATH_PREFIXES.some((prefix) =>
    upstreamPath.startsWith(prefix),
  );
  return {
    upstreamUrl: new URL(upstreamPath, `${input.shopApiBaseUrl}/`),
    requiresRecentAuth,
  };
}
