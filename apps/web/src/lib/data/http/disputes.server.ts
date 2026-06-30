import "server-only";

import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import type { AdminDisputesPageParams } from "@/lib/data/http/disputes.shared";
import {
  type AdminDisputesPage,
  buildAdminDisputesSearchParams,
  parseAdminDisputesPageBody,
} from "@/lib/data/http/disputes.shared";

export type {
  AdminDisputesPage,
  AdminDisputesPageParams,
  DisputeListStatus,
} from "@/lib/data/http/disputes.shared";

/** Server-side paginated disputes list with summary counts. */
export async function getAdminDisputesPage(
  params: AdminDisputesPageParams,
): Promise<AdminDisputesPage> {
  const qs = buildAdminDisputesSearchParams(params);
  const res = await authedServerFetch(`/admin/finance/disputes?${qs}`);
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

/** Finance admin: count of open dispute cases for nav badges. */
export async function getAdminDisputeOpenCount(): Promise<number> {
  const res = await authedServerFetch("/admin/finance/disputes/open-count");
  if (!res.ok) throw new Error(`Failed to load dispute open count: ${res.status}`);
  const body = (await res.json()) as { data?: { count?: number } };
  return Number(body.data?.count ?? 0);
}
