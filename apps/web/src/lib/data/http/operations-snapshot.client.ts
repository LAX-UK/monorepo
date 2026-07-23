import { parseAdminSaleOperationsSnapshot } from "@/lib/data/http/admin-operations-snapshot.schema";
import type { AdminSaleOperationsSnapshot } from "@/lib/data/http/admin-operations-snapshot.types";
import type { AdminPaddleRosterEntry } from "@/lib/data/http/admin-paddle.types";
import { adminSaleListRowsSchema } from "@/lib/data/http/admin-sale-registrations.schema";
import {
  adminPaddleRosterItemsEnvelopeSchema,
  adminSaleroomSessionStatusRowSchema,
} from "@/lib/data/http/admin-saleroom.schema";
import { readDataEnvelope } from "@/lib/data/http/envelope";
import { browserApiBase, browserFetch } from "@/lib/data/http/hc-browser";

export async function fetchAdminSaleOperationsSnapshot(
  saleId: string,
): Promise<AdminSaleOperationsSnapshot | null> {
  const res = await browserFetch(
    `${browserApiBase()}/admin/sales/${encodeURIComponent(saleId)}/operations-snapshot`,
    { cache: "no-store" },
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to load operations snapshot (${res.status})`);
  const body = (await res.json()) as { data?: unknown };
  return parseAdminSaleOperationsSnapshot(body.data ?? null);
}

export async function fetchAdminSalePaddleRoster(
  saleId: string,
): Promise<AdminPaddleRosterEntry[]> {
  const res = await browserFetch(
    `${browserApiBase()}/admin/sales/${encodeURIComponent(saleId)}/paddles`,
    { cache: "no-store" },
  );
  if (!res.ok) throw new Error(`Failed to load paddle roster (${res.status})`);
  const body = (await res.json()) as { data?: unknown };
  return readDataEnvelope(body, adminPaddleRosterItemsEnvelopeSchema, "GET paddles");
}

/** Capability-aligned admin sales list for saleroom hub/switcher (not public /sales). */
export async function fetchAdminSalesListForSaleroom(limit = 50) {
  const qs = new URLSearchParams({ limit: String(Math.min(limit, 100)), offset: "0" });
  const res = await browserFetch(`${browserApiBase()}/sales?${qs.toString()}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to load sales: ${res.status}`);
  const body = (await res.json()) as { data?: unknown };
  return readDataEnvelope(body, adminSaleListRowsSchema, "GET /sales");
}

export async function fetchAdminSaleroomSessionStatuses(saleIds: string[]) {
  if (saleIds.length === 0) return [];
  const res = await browserFetch(
    `${browserApiBase()}/admin/saleroom/sessions?saleIds=${saleIds.map(encodeURIComponent).join(",")}`,
    { cache: "no-store" },
  );
  if (!res.ok) throw new Error(`Failed to load saleroom sessions: ${res.status}`);
  const body = (await res.json()) as { sessions?: unknown[] };
  const sessions = Array.isArray(body.sessions) ? body.sessions : [];
  return sessions.map((row) => adminSaleroomSessionStatusRowSchema.parse(row));
}
