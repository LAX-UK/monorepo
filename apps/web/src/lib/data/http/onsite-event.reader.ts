import "server-only";

import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import { readDataEnvelope, readJsonBody, readNullableListEnvelope } from "@/lib/data/http/envelope";
import {
  nullableOnsiteEventAdminDetailSchema,
  onsiteEventListItemSchema,
  onsiteEventRsvpAdminRowSchema,
} from "@/lib/data/http/onsite-event.schema";
import type {
  OnsiteEventAdminDetail,
  OnsiteEventListItem,
  OnsiteEventRsvpAdminRow,
} from "@auction/types";

export async function getAdminOnsiteEvents(): Promise<OnsiteEventListItem[]> {
  const res = await authedServerFetch("/admin/event-rsvps", { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load event RSVPs: ${res.status}`);
  const body = await readJsonBody(res);
  const { rows } = readNullableListEnvelope(
    body,
    onsiteEventListItemSchema,
    "GET /admin/event-rsvps",
  );
  return rows;
}

export async function getAdminOnsiteEventDetail(
  slug: string,
): Promise<OnsiteEventAdminDetail | null> {
  const res = await authedServerFetch(`/admin/event-rsvps/${encodeURIComponent(slug)}`, {
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to load onsite event: ${res.status}`);
  const body = await readJsonBody(res);
  return readDataEnvelope(
    body,
    nullableOnsiteEventAdminDetailSchema,
    `GET /admin/event-rsvps/${slug}`,
  );
}

export async function getAdminOnsiteEventRsvps(slug: string): Promise<OnsiteEventRsvpAdminRow[]> {
  const res = await authedServerFetch(`/admin/event-rsvps/${encodeURIComponent(slug)}/rsvps`, {
    cache: "no-store",
  });
  if (res.status === 404) {
    throw new Error("Onsite event not found");
  }
  if (!res.ok) throw new Error(`Failed to load onsite event RSVPs: ${res.status}`);
  const body = await readJsonBody(res);
  const { rows } = readNullableListEnvelope(
    body,
    onsiteEventRsvpAdminRowSchema,
    `GET /admin/event-rsvps/${slug}/rsvps`,
  );
  return rows;
}
