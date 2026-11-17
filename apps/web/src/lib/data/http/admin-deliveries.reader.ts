import "server-only";

import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import { readDataEnvelope, readJsonBody, safeReadData } from "@/lib/data/http/envelope";
import {
  type DeliveriesPage,
  type DeliveryView,
  deliveriesPageSchema,
  deliveriesSummarySchema,
  deliveryViewSchema,
} from "./admin-deliveries.schema";

/** One view of the Deliveries list; throws "forbidden" or when the Bid API does not answer. */
export async function getAdminDeliveries(query: URLSearchParams): Promise<DeliveriesPage> {
  const res = await authedServerFetch(`/admin/deliveries?${query.toString()}`, {
    cache: "no-store",
  });
  if (res.status === 403 || res.status === 401) throw new Error("forbidden");
  if (!res.ok) throw new Error(`Deliveries unavailable: ${res.status}`);
  return readDataEnvelope(await readJsonBody(res), deliveriesPageSchema, "GET /admin/deliveries");
}

/** One lot's delivery for the panel; null when nobody asked for one. */
export async function getAdminDelivery(lotId: string): Promise<DeliveryView | null> {
  const res = await authedServerFetch(`/admin/deliveries/${encodeURIComponent(lotId)}`, {
    cache: "no-store",
  });
  return safeReadData(res, deliveryViewSchema, {
    context: "GET /admin/deliveries/:lotId",
    nullStatuses: [404],
    notOkMessage: (status) => (status === 403 ? "forbidden" : `Delivery unavailable: ${status}`),
  });
}

/** How many buyers are waiting for a delivery price: one number for the sidebar. */
export async function getAdminDeliveriesWaitingCount(): Promise<number> {
  const res = await authedServerFetch("/admin/deliveries/summary", { cache: "no-store" });
  if (!res.ok) throw new Error(`Deliveries count unavailable: ${res.status}`);
  return readDataEnvelope(
    await readJsonBody(res),
    deliveriesSummarySchema,
    "GET /admin/deliveries/summary",
  ).waitingCount;
}
