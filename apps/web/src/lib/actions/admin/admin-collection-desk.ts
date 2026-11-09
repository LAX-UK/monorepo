"use server";

import { COLLECTIONS_PATH } from "@/lib/admin/collections/collections.vm";
import { denyUnlessAdminCapability } from "@/lib/auth/assert-admin-action-capability";
import { isStaffStepUpResponse } from "@/lib/auth/step-up/staff-step-up.server";
import {
  deskBookingSchema,
  deskClientLotsSchema,
  deskDaySchema,
} from "@/lib/data/http/admin-collection-desk.schema";
import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import { readDataEnvelope, readJsonBody } from "@/lib/data/http/envelope";
import { type ActionResult, actionFailure, actionSuccess } from "@/lib/forms/form-result";
import { COLLECTIONS_ACCESS, COLLECTIONS_READ_ACCESS } from "@/lib/navigation/staff-nav-access";
import { instrumentServerAction } from "@/lib/observability/instrument-server-action";
import { STAFF_STEP_UP_REQUIRED } from "@auction/identity-contracts/staff-step-up";
import type { DeskBookingView, DeskClientLot, DeskDayView } from "@auction/types";
import {
  collectionDeskBookForClientBodySchema,
  collectionDeskHandOverBodySchema,
  collectionDeskRebookBodySchema,
} from "@auction/validators";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const API = "/admin/collection-desk";
const UNAVAILABLE = "We couldn't reach the collections desk. Nothing was changed. Try again.";

const idSchema = z.string().uuid();
const keySchema = z.string().regex(/^[A-Za-z0-9_-]{8,128}$/);

type Refusal = {
  error?: string;
  message?: string;
  lotId?: string;
  lotIds?: string[];
  reason?: string;
  issues?: unknown;
};

/** The API's refusal as an action result, keeping the code and the lots at fault. */
async function refusal(res: Response): Promise<ActionResult<never>> {
  if (await isStaffStepUpResponse(res)) {
    return actionFailure("Recent sign-in required", undefined, 403, STAFF_STEP_UP_REQUIRED);
  }
  const body = (await res.json().catch(() => ({}))) as Refusal;
  return actionFailure(body.message ?? UNAVAILABLE, undefined, res.status, body.error, {
    ...(body.lotId ? { lotId: body.lotId } : {}),
    ...(body.lotIds ? { lotIds: body.lotIds } : {}),
    ...(body.reason ? { reason: body.reason } : {}),
    ...(body.issues ? { issues: body.issues } : {}),
  });
}

async function write<T>(
  name: string,
  path: string,
  body: unknown,
  schema: z.ZodType<T>,
  idempotencyKey: string | null,
): Promise<ActionResult<T>> {
  return instrumentServerAction(name, async () => {
    const denied = await denyUnlessAdminCapability(COLLECTIONS_ACCESS);
    if (denied) return denied;
    const res = await authedServerFetch(`${API}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
      },
      body: JSON.stringify(body),
    }).catch(() => null);
    if (!res) return actionFailure(UNAVAILABLE, undefined, 503);
    if (!res.ok) return refusal(res);
    const value = readDataEnvelope(await readJsonBody(res), schema, `POST ${API}${path}`);
    revalidatePath(COLLECTIONS_PATH);
    return actionSuccess(value);
  });
}

const invalid = () => actionFailure("Check the details and try again.", undefined, 400);

/**
 * Hands the ticked lots over after the photo ID check. `idempotencyKey` is made once per attempt
 * by the panel, so a double tap or a retry hands a work over once.
 */
export async function handOverCollectionAction(
  bookingId: string,
  input: unknown,
  idempotencyKey: string,
): Promise<ActionResult<DeskBookingView>> {
  const id = idSchema.safeParse(bookingId);
  const body = collectionDeskHandOverBodySchema.safeParse(input);
  const key = keySchema.safeParse(idempotencyKey);
  if (!id.success || !body.success || !key.success) return invalid();
  return write(
    "handOverCollectionAction",
    `/bookings/${id.data}/hand-over`,
    body.data,
    deskBookingSchema,
    key.data,
  );
}

export async function undoHandOverCollectionAction(
  bookingId: string,
  idempotencyKey: string,
): Promise<ActionResult<DeskBookingView>> {
  const id = idSchema.safeParse(bookingId);
  const key = keySchema.safeParse(idempotencyKey);
  if (!id.success || !key.success) return invalid();
  return write(
    "undoHandOverCollectionAction",
    `/bookings/${id.data}/undo-hand-over`,
    {},
    deskBookingSchema,
    key.data,
  );
}

export async function markNotCollectedAction(
  bookingId: string,
  idempotencyKey: string,
): Promise<ActionResult<DeskBookingView>> {
  const id = idSchema.safeParse(bookingId);
  const key = keySchema.safeParse(idempotencyKey);
  if (!id.success || !key.success) return invalid();
  return write(
    "markNotCollectedAction",
    `/bookings/${id.data}/not-collected`,
    {},
    deskBookingSchema,
    key.data,
  );
}

export async function rebookCollectionAction(
  bookingId: string,
  input: unknown,
): Promise<ActionResult<DeskBookingView>> {
  const id = idSchema.safeParse(bookingId);
  const body = collectionDeskRebookBodySchema.safeParse(input);
  if (!id.success || !body.success) return invalid();
  return write(
    "rebookCollectionAction",
    `/bookings/${id.data}/rebook`,
    body.data,
    deskBookingSchema,
    null,
  );
}

export async function bookForClientAction(input: unknown): Promise<ActionResult<DeskBookingView>> {
  const body = collectionDeskBookForClientBodySchema.safeParse(input);
  if (!body.success) return invalid();
  return write("bookForClientAction", "/bookings", body.data, deskBookingSchema, null);
}

async function read<T>(name: string, path: string, schema: z.ZodType<T>): Promise<ActionResult<T>> {
  return instrumentServerAction(name, async () => {
    const denied = await denyUnlessAdminCapability(COLLECTIONS_READ_ACCESS);
    if (denied) return denied;
    const res = await authedServerFetch(`${API}${path}`).catch(() => null);
    if (!res) return actionFailure(UNAVAILABLE, undefined, 503);
    if (!res.ok) return refusal(res);
    return actionSuccess(readDataEnvelope(await readJsonBody(res), schema, `GET ${API}${path}`));
  });
}

/** A day's times and places, for choosing a time to rebook or book into. */
export async function loadDeskDayAction(
  venueId: string,
  date: string,
): Promise<ActionResult<DeskDayView>> {
  const id = idSchema.safeParse(venueId);
  if (!id.success || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return invalid();
  return read("loadDeskDayAction", `/${id.data}/day?date=${date}`, deskDaySchema);
}

/** A client's works at the place, for booking on their behalf. */
export async function loadDeskClientLotsAction(
  venueId: string,
  legalEntityId: string,
): Promise<ActionResult<DeskClientLot[]>> {
  const venue = idSchema.safeParse(venueId);
  const entity = idSchema.safeParse(legalEntityId);
  if (!venue.success || !entity.success) return invalid();
  return read(
    "loadDeskClientLotsAction",
    `/${venue.data}/client-lots?legalEntityId=${entity.data}`,
    z.array(deskClientLotsSchema),
  );
}
