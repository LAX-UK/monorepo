import {
  type AdminDisputesPage,
  type AdminDisputesPageParams,
  buildAdminDisputesSearchParams,
  parseAdminDisputesPageBody,
} from "@/lib/data/http/disputes.shared";
import { browserApiBase, browserFetch } from "@/lib/data/http/hc-browser";

/** Browser fetch for admin disputes list (TanStack Query queryFn — not a Server Action). */
export async function fetchAdminDisputesPage(
  params: AdminDisputesPageParams,
): Promise<AdminDisputesPage> {
  const qs = buildAdminDisputesSearchParams(params);
  const url = `${browserApiBase()}/admin/finance/disputes?${qs}`;
  const res = await browserFetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to load dispute cases: ${res.status}`);
  }
  const body = (await res.json()) as {
    data: Record<string, unknown>[];
    hasNextPage?: boolean;
    summary?: Record<string, unknown>;
  };
  return parseAdminDisputesPageBody(body);
}
