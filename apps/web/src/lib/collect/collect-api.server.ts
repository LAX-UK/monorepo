import "server-only";

import { getServerDataContainer } from "@/lib/data/container.server";
import { authedServerFetch } from "@/lib/data/http/authed-fetch.server";
import { readDataEnvelope } from "@/lib/data/http/envelope";
import { X_LEGAL_ENTITY_ID_HEADER } from "@/lib/legal-entity/client-acting-context";
import { purchaseRequestAccountId } from "@/lib/purchases/purchase-account";
import type { CollectionAvailability, CollectionVisitView } from "@auction/types";
import type { z } from "zod";
import { type CollectFailure, collectFailure } from "./collect-errors";
import type { CollectRequestBody } from "./collect-form";
import {
  collectionAvailabilitySchema,
  collectionVisitSchema,
  collectionVisitsSchema,
} from "./collect.schema";

const BASE = "/legal-entities/collection";

/**
 * Calls the collection endpoints for the account in use. A person's own account is named too:
 * collections work for personal accounts as they do for organisations.
 */
async function collectApiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const scope = await (await getServerDataContainer()).buying.scope();
  const account = purchaseRequestAccountId(scope.account, { includePersonal: true });
  return authedServerFetch(`${BASE}${path}`, {
    ...init,
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(account ? { [X_LEGAL_ENTITY_ID_HEADER]: account } : {}),
    },
  });
}

export type CollectRead<T> = { ok: true; value: T } | { ok: false; failure: CollectFailure };

async function bodyOf(res: Response): Promise<unknown> {
  return res.json().catch(() => null);
}

/** Reads a successful answer with the schema; anything else is a refusal the page can show. */
async function read<T>(
  res: Response,
  schema: z.ZodType<T>,
  takenAt: string | null = null,
): Promise<CollectRead<T>> {
  const body = await bodyOf(res);
  if (!res.ok) return { ok: false, failure: collectFailure(res.status, body, takenAt) };
  try {
    return { ok: true, value: readDataEnvelope(body, schema, "collection") };
  } catch {
    return { ok: false, failure: collectFailure(503, null, takenAt) };
  }
}

async function guarded<T>(run: () => Promise<CollectRead<T>>): Promise<CollectRead<T>> {
  try {
    return await run();
  } catch {
    return { ok: false, failure: collectFailure(503, null, null) };
  }
}

/** The times and the lots' standing for these lots; `booking` is a visit being moved. */
export function loadAvailability(
  lotIds: readonly string[],
  bookingId: string | null = null,
): Promise<CollectRead<CollectionAvailability>> {
  const query = [
    `lots=${lotIds.map(encodeURIComponent).join(",")}`,
    bookingId ? `booking=${encodeURIComponent(bookingId)}` : null,
  ]
    .filter(Boolean)
    .join("&");
  return guarded(async () =>
    read(await collectApiFetch(`/availability?${query}`), collectionAvailabilitySchema),
  );
}

/** The account's visits the person may see. */
export function loadVisits(): Promise<CollectRead<CollectionVisitView[]>> {
  return guarded(async () => read(await collectApiFetch("/bookings"), collectionVisitsSchema));
}

export function postBooking(
  body: CollectRequestBody,
  idempotencyKey: string,
  takenAt: string | null,
): Promise<CollectRead<CollectionVisitView>> {
  return guarded(async () =>
    read(
      await collectApiFetch("/bookings", {
        method: "POST",
        body: JSON.stringify({ ...body, idempotencyKey }),
      }),
      collectionVisitSchema,
      takenAt,
    ),
  );
}

export function patchBooking(
  bookingId: string,
  version: number,
  body: CollectRequestBody,
  takenAt: string | null,
): Promise<CollectRead<CollectionVisitView>> {
  return guarded(async () =>
    read(
      await collectApiFetch(`/bookings/${encodeURIComponent(bookingId)}`, {
        method: "PATCH",
        body: JSON.stringify({ version, ...body }),
      }),
      collectionVisitSchema,
      takenAt,
    ),
  );
}

export function postCancel(
  bookingId: string,
  version: number,
): Promise<CollectRead<CollectionVisitView>> {
  return guarded(async () =>
    read(
      await collectApiFetch(`/bookings/${encodeURIComponent(bookingId)}/cancel`, {
        method: "POST",
        body: JSON.stringify({ version }),
      }),
      collectionVisitSchema,
    ),
  );
}

/** The calendar file of a booked visit, as the API sends it. */
export function fetchCalendarFile(bookingId: string): Promise<Response> {
  return collectApiFetch(`/bookings/${encodeURIComponent(bookingId)}/calendar.ics`);
}
