import "server-only";

import { parseAdminSaleOperationsSnapshot } from "@/lib/data/http/admin-operations-snapshot.schema";
import type { AdminSaleOperationsSnapshot } from "@/lib/data/http/admin-operations-snapshot.types";
import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import type { AdminTelephoneBookingRow } from "@/lib/telephone/telephone-booking-types";
import { parseAdminTelephoneBookingRow } from "@/lib/telephone/telephone-booking-types";

export type { AdminSaleOperationsSnapshot, AdminTelephoneBookingRow };

export async function getAdminTelephoneBookings(
  saleId: string,
  status?: string,
): Promise<AdminTelephoneBookingRow[]> {
  const qs = status ? `?status=${encodeURIComponent(status)}` : "";
  const res = await authedServerFetch(
    `/admin/sales/${encodeURIComponent(saleId)}/telephone-bookings${qs}`,
    { cache: "no-store" },
  );
  if (!res.ok) throw new Error(`Failed to load telephone bookings: ${res.status}`);
  const body = (await res.json()) as { data?: { items?: unknown[] } };
  return (body.data?.items ?? [])
    .map(parseAdminTelephoneBookingRow)
    .filter((r): r is AdminTelephoneBookingRow => r != null);
}

export async function getAdminTelephoneBookingsPendingCount(): Promise<number> {
  const res = await authedServerFetch("/admin/telephone-bookings/pending-count", {
    cache: "no-store",
  });
  if (!res.ok) return 0;
  const body = (await res.json()) as { data?: { count?: number } };
  return typeof body.data?.count === "number" ? body.data.count : 0;
}

export async function getAdminSaleOperationsSnapshot(
  saleId: string,
): Promise<AdminSaleOperationsSnapshot | null> {
  const res = await authedServerFetch(
    `/admin/sales/${encodeURIComponent(saleId)}/operations-snapshot`,
    { cache: "no-store" },
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to load operations snapshot: ${res.status}`);
  const body = (await res.json()) as { data?: unknown };
  return parseAdminSaleOperationsSnapshot(body.data ?? null);
}
