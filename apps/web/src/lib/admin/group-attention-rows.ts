import type { AdminAttentionRow, AttentionDomain } from "@/lib/admin/admin-home-types";

export type GroupedAttentionRows = {
  domain: AttentionDomain;
  items: AdminAttentionRow[];
};

const DOMAIN_ORDER: AttentionDomain[] = [
  "Finance",
  "Compliance",
  "People",
  "Catalog",
  "Operations",
];

const ID_DOMAIN: Record<string, AttentionDomain> = {
  "nav-manual-review": "Finance",
  "nav-disputes": "Finance",
  "nav-payouts-failed": "Finance",
  "nav-aml-screenings": "Compliance",
  "nav-sof-cases": "Compliance",
  "nav-onboarding-issues": "People",
  "nav-invitations": "People",
  "nav-submissions": "Catalog",
  "nav-artists": "Catalog",
  "nav-withdrawals": "Catalog",
  "nav-draft-photos": "Catalog",
  "nav-sales-setup": "Catalog",
  "nav-saleroom-live": "Operations",
  "nav-telephone-bookings": "Operations",
  "nav-condition-reports": "Operations",
  "nav-fulfilment": "Operations",
};

function inferDomain(row: AdminAttentionRow): AttentionDomain {
  if (row.domain) return row.domain;
  const mapped = ID_DOMAIN[row.id];
  if (mapped) return mapped;
  if (
    row.href.includes("/payments") ||
    row.href.includes("/payouts") ||
    row.href.includes("/disputes")
  ) {
    return "Finance";
  }
  if (row.href.includes("/compliance")) return "Compliance";
  if (
    row.href.includes("/onboarding") ||
    row.href.includes("/invitations") ||
    row.href.includes("/clients")
  ) {
    return "People";
  }
  if (
    row.href.includes("/saleroom") ||
    row.href.includes("/lot-fulfilment") ||
    row.href.includes("/condition-reports")
  ) {
    return "Operations";
  }
  return "Catalog";
}

/** Groups attention rows by operational domain for the staff home queue widget. */
export function groupAttentionRows(rows: readonly AdminAttentionRow[]): GroupedAttentionRows[] {
  const buckets = new Map<AttentionDomain, AdminAttentionRow[]>();
  for (const row of rows) {
    const domain = inferDomain(row);
    const list = buckets.get(domain) ?? [];
    list.push(row);
    buckets.set(domain, list);
  }
  return DOMAIN_ORDER.filter((domain) => (buckets.get(domain)?.length ?? 0) > 0).map((domain) => ({
    domain,
    items: buckets.get(domain) ?? [],
  }));
}
