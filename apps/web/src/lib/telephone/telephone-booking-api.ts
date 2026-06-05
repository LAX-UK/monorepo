import { browserApiBase, browserFetch } from "@/lib/data/http/hc-browser";
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

function apiBase(): string {
  return browserApiBase();
}

async function readError(res: Response): Promise<string> {
  const body = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
  return body.error ?? `Request failed (${res.status})`;
}

export async function createTelephoneBooking(input: {
  saleId: string;
  buyerLegalEntityId: string;
  lotIds?: string[];
  authorizedMax?: number;
  buyerNotes?: string;
}): Promise<{ ok: true; booking: TelephoneBookingSnapshot } | { ok: false; message: string }> {
  const res = await browserFetch(
    `${apiBase()}/sales/${encodeURIComponent(input.saleId)}/telephone-bookings`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        buyerLegalEntityId: input.buyerLegalEntityId,
        ...(input.lotIds?.length ? { lotIds: input.lotIds } : {}),
        ...(input.authorizedMax != null ? { authorizedMax: input.authorizedMax } : {}),
        ...(input.buyerNotes?.trim() ? { buyerNotes: input.buyerNotes.trim() } : {}),
      }),
    },
  );
  if (!res.ok) {
    return { ok: false, message: await readError(res) };
  }
  const body = (await res.json()) as { data?: unknown };
  const booking = parseTelephoneBookingSnapshot(body.data);
  if (!booking) {
    return { ok: false, message: "Unexpected response from server" };
  }
  return { ok: true, booking };
}

export async function fetchMyTelephoneBookingForSale(
  saleId: string,
): Promise<TelephoneBookingSnapshot | null> {
  const res = await browserFetch(
    `${apiBase()}/sales/${encodeURIComponent(saleId)}/telephone-bookings/mine`,
    { cache: "no-store" },
  );
  if (res.status === 401 || res.status === 403 || res.status === 404) return null;
  if (!res.ok) return null;
  const body = (await res.json()) as { data?: unknown };
  if (body.data == null) return null;
  return parseTelephoneBookingSnapshot(body.data);
}

export async function fetchMyTelephoneBookings(): Promise<TelephoneBookingListItem[]> {
  const res = await browserFetch(`${apiBase()}/users/me/telephone-bookings`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Failed to load telephone bookings: ${res.status}`);
  }
  const body = (await res.json()) as { data?: { items?: unknown[] } };
  return (body.data?.items ?? [])
    .map(parseTelephoneBookingListItem)
    .filter((r): r is TelephoneBookingListItem => r != null);
}

export async function fetchTelephoneBookingDetail(
  bookingId: string,
): Promise<TelephoneBookingDetail | null> {
  const res = await browserFetch(
    `${apiBase()}/telephone-bookings/${encodeURIComponent(bookingId)}`,
    {
      cache: "no-store",
    },
  );
  if (res.status === 401 || res.status === 403 || res.status === 404) return null;
  if (!res.ok) return null;
  const body = (await res.json()) as { data?: unknown };
  return parseTelephoneBookingDetail(body.data ?? null);
}

export async function requestTelephoneBookingLimitIncrease(
  bookingId: string,
  amount: number,
): Promise<{ ok: true; booking: TelephoneBookingSnapshot } | { ok: false; message: string }> {
  const res = await browserFetch(
    `${apiBase()}/telephone-bookings/${encodeURIComponent(bookingId)}/limit-increase`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount }),
    },
  );
  if (!res.ok) {
    return { ok: false, message: await readError(res) };
  }
  const body = (await res.json()) as { data?: unknown };
  const booking = parseTelephoneBookingSnapshot(body.data);
  if (!booking) {
    return { ok: false, message: "Unexpected response from server" };
  }
  return { ok: true, booking };
}

export async function cancelTelephoneBooking(
  bookingId: string,
  reason?: string,
): Promise<{ ok: true; booking: TelephoneBookingSnapshot } | { ok: false; message: string }> {
  const res = await browserFetch(
    `${apiBase()}/telephone-bookings/${encodeURIComponent(bookingId)}/cancel`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(reason?.trim() ? { reason: reason.trim() } : {}),
    },
  );
  if (!res.ok) {
    return { ok: false, message: await readError(res) };
  }
  const body = (await res.json()) as { data?: unknown };
  const booking = parseTelephoneBookingSnapshot(body.data);
  if (!booking) {
    return { ok: false, message: "Unexpected response from server" };
  }
  return { ok: true, booking };
}
