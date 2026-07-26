import type { CatalogDetailTabSpec } from "@/lib/admin/catalog/catalog-detail-tab.types";

/** Legacy query-tab ids kept for deep-link backwards compatibility. */
export const DETAIL_QUERY_TAB_ALIASES: Record<string, string> = {
  bids: "won-lots",
  payouts: "payments",
  lifecycle: "compliance",
};

export type DetailQueryTabSpec = {
  id: string;
  label: string;
  badge?: "pending" | "warning" | "default";
  count?: number;
};

/** Resolve a `?tab=` value against registered tab ids (with legacy aliases). */
export function resolveDetailQueryTab(
  urlTab: string | null | undefined,
  tabs: readonly Pick<DetailQueryTabSpec, "id">[],
  defaultTab: string,
): string {
  const normalized = urlTab?.trim() ?? "";
  const resolved = normalized ? (DETAIL_QUERY_TAB_ALIASES[normalized] ?? normalized) : null;
  return resolved && tabs.some((tab) => tab.id === resolved) ? resolved : defaultTab;
}

/** Map route-segment tab ids to legacy `?tab=` values for redirects. */
export function legacyQueryTabForRouteSegment(routeTabId: string): string {
  const reverse = Object.entries(DETAIL_QUERY_TAB_ALIASES).find(([, v]) => v === routeTabId);
  return reverse?.[0] ?? routeTabId;
}

export type LegalEntityDetailRouteTab =
  | "overview"
  | "documents"
  | "compliance"
  | "stripe"
  | "activity"
  | "sales";

const LEGAL_ENTITY_ROUTE_TABS = new Set<string>([
  "overview",
  "documents",
  "compliance",
  "stripe",
  "activity",
  "sales",
]);

/** Map legacy legal-entity `?tab=` values to route segments. */
export function resolveLegalEntityRouteTab(
  urlTab: string | null | undefined,
): LegalEntityDetailRouteTab {
  const normalized = urlTab?.trim() ?? "";
  const aliased = normalized ? (DETAIL_QUERY_TAB_ALIASES[normalized] ?? normalized) : "";
  if (LEGAL_ENTITY_ROUTE_TABS.has(aliased)) {
    return aliased as LegalEntityDetailRouteTab;
  }
  return "overview";
}

export function legalEntityDetailTabHref(entityId: string, tab: LegalEntityDetailRouteTab): string {
  const base = `/admin/legal-entities/${encodeURIComponent(entityId)}`;
  return tab === "overview" ? base : `${base}/${tab}`;
}

/** Build catalog tab nav specs for legal entity route segments. */
export function buildLegalEntityDetailTabSpecs(input: {
  entityId: string;
  pendingDocCount: number;
  stripeDueCount: number;
  saleCount?: number;
}): CatalogDetailTabSpec[] {
  const { entityId, pendingDocCount, stripeDueCount, saleCount = 0 } = input;
  return [
    {
      id: "overview",
      label: "Overview",
      href: legalEntityDetailTabHref(entityId, "overview"),
    },
    {
      id: "documents",
      label: "Documents",
      href: legalEntityDetailTabHref(entityId, "documents"),
      ...(pendingDocCount > 0 ? { count: pendingDocCount, badge: "pending" as const } : {}),
    },
    {
      id: "compliance",
      label: "Compliance",
      href: legalEntityDetailTabHref(entityId, "compliance"),
    },
    {
      id: "stripe",
      label: "Stripe",
      href: legalEntityDetailTabHref(entityId, "stripe"),
      ...(stripeDueCount > 0 ? { count: stripeDueCount, badge: "pending" as const } : {}),
    },
    {
      id: "sales",
      label: "Sales",
      href: legalEntityDetailTabHref(entityId, "sales"),
      ...(saleCount > 0 ? { count: saleCount } : {}),
    },
    {
      id: "activity",
      label: "Activity",
      href: legalEntityDetailTabHref(entityId, "activity"),
    },
  ];
}

export function peopleDetailTabHref(
  kind: "clients" | "staff",
  userId: string,
  tabId: string,
  listReturnTo?: string,
): string {
  const base = `/admin/${kind}/${encodeURIComponent(userId)}`;
  const params = new URLSearchParams();
  if (tabId !== "overview") params.set("tab", tabId);
  if (listReturnTo?.trim()) params.set("returnTo", listReturnTo.trim());
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}
