import "server-only";

import {
  type AdminWorkItemsResponse,
  parseAdminWorkItemsResponse,
} from "@/lib/data/http/admin-work-items.schema";
import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";

export type AdminWorkItemsQuery = {
  domain?: string;
  assignment?: "mine" | "unassigned" | "all";
  urgentOnly?: boolean;
  limit?: number;
  cursor?: string;
};

export async function getAdminWorkItems(
  query: AdminWorkItemsQuery = {},
): Promise<AdminWorkItemsResponse> {
  const params = new URLSearchParams();
  if (query.domain) params.set("domain", query.domain);
  if (query.assignment) params.set("assignment", query.assignment);
  if (query.urgentOnly) params.set("urgentOnly", "true");
  if (query.limit != null) params.set("limit", String(query.limit));
  if (query.cursor) params.set("cursor", query.cursor);

  const qs = params.toString();
  const res = await authedServerFetch(`/admin/work-items${qs ? `?${qs}` : ""}`);
  if (!res.ok) {
    throw new Error(`work-items fetch failed: ${res.status}`);
  }
  const body = (await res.json()) as { data?: unknown };
  const parsed = parseAdminWorkItemsResponse(body.data);
  if (!parsed) {
    throw new Error("work-items response invalid");
  }
  return parsed;
}
