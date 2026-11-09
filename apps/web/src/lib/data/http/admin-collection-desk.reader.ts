import "server-only";

import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import { readData } from "@/lib/data/http/envelope";
import { z } from "zod";
import {
  deskClientLotsSchema,
  deskDaySchema,
  deskListSchema,
} from "./admin-collection-desk.schema";

const PATH = "/admin/collection-desk";

const notOk = (status: number) =>
  status === 403 ? "forbidden" : `Collections unavailable: ${status}`;

/** One London day of visits at a place, grouped by time. */
export async function getDeskDay(venueId: string, date: string) {
  const res = await authedServerFetch(
    `${PATH}/${encodeURIComponent(venueId)}/day?date=${encodeURIComponent(date)}`,
  );
  return readData(res, deskDaySchema, {
    context: "GET /admin/collection-desk/:venueId/day",
    notOkMessage: notOk,
  });
}

/** The visits to come, or the missed ones nobody has followed up. */
export async function getDeskList(venueId: string, status: "upcoming" | "not_collected") {
  const res = await authedServerFetch(
    `${PATH}/${encodeURIComponent(venueId)}/bookings?status=${status}`,
  );
  return readData(res, deskListSchema, {
    context: "GET /admin/collection-desk/:venueId/bookings",
    notOkMessage: notOk,
  });
}

/** A client's works at the place, for booking a visit on their behalf. */
export async function getDeskClientLots(venueId: string, legalEntityId: string) {
  const res = await authedServerFetch(
    `${PATH}/${encodeURIComponent(venueId)}/client-lots?legalEntityId=${encodeURIComponent(legalEntityId)}`,
  );
  return readData(res, z.array(deskClientLotsSchema), {
    context: "GET /admin/collection-desk/:venueId/client-lots",
    notOkMessage: notOk,
  });
}
