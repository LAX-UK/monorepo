"use server";

import { CLIENT_ROUTES } from "@/lib/navigation/client-routes";
import { instrumentServerAction } from "@/lib/observability/instrument-server-action";
import type { CollectionAvailability, CollectionVisitView } from "@auction/types";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { loadAvailability, patchBooking, postBooking, postCancel } from "./collect-api.server";
import { type CollectFailure, collectFailure } from "./collect-errors";

/** What every collection action answers: the visit (or times), or a refusal the page shows. */
export type CollectActionResult<T> =
  | { ok: true; value: T }
  | { ok: false; failure: CollectFailure };

const lotIds = z.array(z.string().uuid()).min(1).max(20);

const collectorSchema = z.object({
  kind: z.enum(["self", "member", "third_party"]),
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().max(254).nullish(),
  company: z.string().trim().max(120).nullish(),
  authorised: z.boolean().optional(),
});

const requestSchema = z.object({
  lotIds,
  slotStart: z.string().datetime({ offset: true }),
  collector: collectorSchema,
});

const idempotencyKey = z.string().regex(/^[A-Za-z0-9_-]{8,128}$/);
const takenAt = z.string().max(60).nullable();
const uuid = z.string().uuid();

const invalid = (): CollectActionResult<never> => ({
  ok: false,
  failure: collectFailure(400, null, null),
});

function refreshed(result: CollectActionResult<CollectionVisitView>) {
  if (result.ok) {
    revalidatePath(CLIENT_ROUTES.purchases);
    revalidatePath(CLIENT_ROUTES.collect);
  }
  return result;
}

/**
 * Books the visit for exactly what the page showed. The key makes a double tap one booking; the
 * server decides who may book which lot, and whether the time is still free.
 */
export async function bookCollectionAction(input: {
  body: z.infer<typeof requestSchema>;
  idempotencyKey: string;
  takenAt: string | null;
}): Promise<CollectActionResult<CollectionVisitView>> {
  return instrumentServerAction("bookCollectionAction", async () => {
    const body = requestSchema.safeParse(input.body);
    const key = idempotencyKey.safeParse(input.idempotencyKey);
    const at = takenAt.safeParse(input.takenAt);
    if (!body.success || !key.success || !at.success) return invalid();
    return refreshed(await postBooking(body.data as never, key.data, at.data));
  });
}

/** Moves a visit, or changes its lots or collector. The old time is kept until the new one is taken. */
export async function changeCollectionAction(input: {
  bookingId: string;
  version: number;
  body: z.infer<typeof requestSchema>;
  takenAt: string | null;
}): Promise<CollectActionResult<CollectionVisitView>> {
  return instrumentServerAction("changeCollectionAction", async () => {
    const id = uuid.safeParse(input.bookingId);
    const body = requestSchema.safeParse(input.body);
    const at = takenAt.safeParse(input.takenAt);
    if (!id.success || !body.success || !at.success || !Number.isInteger(input.version)) {
      return invalid();
    }
    return refreshed(await patchBooking(id.data, input.version, body.data as never, at.data));
  });
}

export async function cancelCollectionAction(input: {
  bookingId: string;
  version: number;
}): Promise<CollectActionResult<CollectionVisitView>> {
  return instrumentServerAction("cancelCollectionAction", async () => {
    const id = uuid.safeParse(input.bookingId);
    if (!id.success || !Number.isInteger(input.version)) return invalid();
    return refreshed(await postCancel(id.data, input.version));
  });
}

/** The times read again, for a page whose time was just taken or whose load failed. */
export async function refreshAvailabilityAction(input: {
  lotIds: string[];
  bookingId: string | null;
}): Promise<CollectActionResult<CollectionAvailability>> {
  return instrumentServerAction("refreshAvailabilityAction", async () => {
    const lots = lotIds.safeParse(input.lotIds);
    const id = input.bookingId === null ? null : uuid.safeParse(input.bookingId);
    if (!lots.success || (id && !id.success)) return invalid();
    return loadAvailability(lots.data, id?.success ? id.data : null);
  });
}
