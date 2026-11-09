import { CLIENT_ROUTES } from "@/lib/navigation/client-routes";

const MAX_LOTS = 20;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The booking page for these lots. */
export function collectHref(lotIds: readonly string[]): string {
  if (lotIds.length === 0) return CLIENT_ROUTES.collect;
  return `${CLIENT_ROUTES.collect}?lots=${lotIds.map(encodeURIComponent).join(",")}`;
}

/** The booking page opened to change one booked visit. */
export function changeCollectionHref(bookingId: string): string {
  return `${CLIENT_ROUTES.collect}?booking=${encodeURIComponent(bookingId)}`;
}

/** The calendar file of a booked visit, through the app so the session and account go with it. */
export function collectionCalendarHref(bookingId: string): string {
  return `${CLIENT_ROUTES.collect}/${encodeURIComponent(bookingId)}/calendar.ics`;
}

export type CollectLink =
  | { kind: "lots"; ids: string[] }
  | { kind: "change"; bookingId: string }
  | { kind: "visits" }
  | { kind: "invalid"; reason: "malformed" | "too_many" };

const first = (raw: string | string[] | undefined): string | undefined =>
  Array.isArray(raw) ? raw[0] : raw;

/**
 * What the booking page was asked for: the lots to book, one visit to change, or neither (the
 * person's visits). A link that cannot be read is told so; it is never guessed at.
 */
export function parseCollectLink(params: {
  lots?: string | string[] | undefined;
  booking?: string | string[] | undefined;
}): CollectLink {
  const booking = first(params.booking);
  if (booking !== undefined) {
    return UUID.test(booking)
      ? { kind: "change", bookingId: booking }
      : { kind: "invalid", reason: "malformed" };
  }
  const raw = first(params.lots);
  if (raw === undefined || raw.trim() === "") return { kind: "visits" };
  const ids = [
    ...new Set(
      raw
        .split(",")
        .map((id) => id.trim())
        .filter((id) => id !== ""),
    ),
  ];
  if (ids.length === 0 || !ids.every((id) => UUID.test(id))) {
    return { kind: "invalid", reason: "malformed" };
  }
  if (ids.length > MAX_LOTS) return { kind: "invalid", reason: "too_many" };
  return { kind: "lots", ids };
}
