import "server-only";

import {
  type AdminSaleReadinessRow,
  parseAdminSaleReadinessItems,
} from "@/lib/data/http/admin-sale-readiness.schema";
import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";

export async function getAdminSaleReadiness(limit = 6): Promise<readonly AdminSaleReadinessRow[]> {
  const res = await authedServerFetch(`/admin/sales/readiness?limit=${limit}`);
  if (!res.ok) {
    throw new Error(`sale-readiness fetch failed: ${res.status}`);
  }
  const body = (await res.json()) as { data?: { items?: unknown } };
  const rawItems = body.data?.items;
  if (!Array.isArray(rawItems)) {
    throw new Error("sale-readiness response invalid");
  }
  const items = parseAdminSaleReadinessItems(rawItems);
  if (items.length !== rawItems.length) {
    throw new Error("sale-readiness response contains invalid rows");
  }
  return items;
}
