import "server-only";

import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import type {
  TelephoneBookingDetail,
  TelephoneBookingListItem,
  TelephoneBookingSnapshot,
} from "@/lib/telephone/telephone-booking-types";
import {
  parseTelephoneBookingDetail,
  parseTelephoneBookingListItem,
  parseTelephoneBookingSnapshot,
} from "@/lib/telephone/telephone-booking-types";
import { cache } from "react";

export const getServerTelephoneBookingForSale = cache(
  async (saleId: string): Promise<TelephoneBookingSnapshot | null> => {
    const res = await authedServerFetch(
      `/sales/${encodeURIComponent(saleId)}/telephone-bookings/mine`,
      { cache: "no-store" },
    );
    if (res.status === 401 || res.status === 403 || res.status === 404) return null;
    if (!res.ok) return null;
    const body = (await res.json()) as { data?: unknown };
    if (body.data == null) return null;
    return parseTelephoneBookingSnapshot(body.data);
  },
);

export async function getServerMyTelephoneBookings(): Promise<TelephoneBookingListItem[]> {
  const res = await authedServerFetch("/users/me/telephone-bookings", { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to load telephone bookings: ${res.status}`);
  }
  const body = (await res.json()) as { data?: { items?: unknown[] } };
  return (body.data?.items ?? [])
    .map(parseTelephoneBookingListItem)
    .filter((r): r is TelephoneBookingListItem => r != null);
}

export async function getServerTelephoneBookingDetail(
  bookingId: string,
): Promise<TelephoneBookingDetail | null> {
  const res = await authedServerFetch(`/telephone-bookings/${encodeURIComponent(bookingId)}`, {
    cache: "no-store",
  });
  if (res.status === 401 || res.status === 403 || res.status === 404) return null;
  if (!res.ok) return null;
  const body = (await res.json()) as { data?: unknown };
  return parseTelephoneBookingDetail(body.data ?? null);
}
