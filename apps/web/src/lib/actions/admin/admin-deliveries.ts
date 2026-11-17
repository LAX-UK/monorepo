"use server";

import { DELIVERIES_COPY } from "@/lib/admin/deliveries/deliveries-copy";
import { DELIVERIES_PATH } from "@/lib/admin/deliveries/deliveries.vm";
import {
  QUOTE_NOTE_MAX_LENGTH,
  quoteDrift,
  quoteRequestBody,
} from "@/lib/admin/deliveries/delivery-quote-form";
import { denyUnlessAdminCapability } from "@/lib/auth/assert-admin-action-capability";
import { isStaffStepUpResponse } from "@/lib/auth/step-up/staff-step-up.server";
import { stepUpRequiredFailure } from "@/lib/auth/step-up/step-up-failure";
import { getAdminDelivery } from "@/lib/data/http/admin-deliveries.reader";
import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import { type ActionResult, actionFailure, actionSuccess } from "@/lib/forms/form-result";
import { DELIVERIES_ACCESS } from "@/lib/navigation/staff-nav-access";
import { instrumentServerAction } from "@/lib/observability/instrument-server-action";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const COPY = DELIVERIES_COPY.quote;

/** Why a quote was not sent, for the dialog to say (D6). */
export type SendQuoteRefusal =
  | "already_quoted"
  | "quote_changed"
  | "forbidden"
  | "invalid"
  | "in_progress"
  | "unavailable";

const inputSchema = z.object({
  lotId: z.string().uuid(),
  pence: z.number().int().positive().max(99_999_999_999_999),
  note: z.string().max(QUOTE_NOTE_MAX_LENGTH * 2),
  expected: z.object({
    status: z.enum(["requested", "quoted"]),
    quotedAt: z.string().nullable(),
  }),
  idempotencyKey: z.string().regex(/^[A-Za-z0-9_-]{8,128}$/),
});

export type SendDeliveryQuoteInput = z.input<typeof inputSchema>;

/** The API's refusals that mean the quote moved on under the dialog. */
const STALE_CODES = new Set(["quote_changed", "quote_step_not_allowed", "purchase_not_found"]);

function refused(code: SendQuoteRefusal, message: string, status: number, meta?: object) {
  return actionFailure(message, undefined, status, code, meta as Record<string, unknown>);
}

/**
 * Send quote and Change quote (D5) through the existing staff route,
 * `PUT /admin/lot-fulfilment/:lotId/delivery-quote`, which checks `operations.fulfilment`, asks
 * for a recent sign-in, prices the quote only while it is still requested or quoted, emails the
 * buyer and replays a repeat of the same Idempotency-Key instead of sending twice.
 *
 * Before writing, it reads the delivery again and compares it with what the dialog showed: if
 * someone else at LAX priced it, or the buyer withdrew or accepted, it says so instead of
 * overwriting their price (the route's own check covers withdrawn and accepted, not a second
 * price). The two steps are not one transaction; the route's compare-and-set is still the last
 * word on the quote's status.
 */
export async function sendDeliveryQuoteAction(
  input: SendDeliveryQuoteInput,
): Promise<ActionResult<{ lotId: string }>> {
  return instrumentServerAction("sendDeliveryQuoteAction", async () => {
    const denied = await denyUnlessAdminCapability(DELIVERIES_ACCESS);
    if (denied) return refused("forbidden", COPY.denied.title, 403);
    const parsed = inputSchema.safeParse(input);
    if (!parsed.success) return refused("invalid", COPY.errors.priceInvalid, 400);
    const { lotId, pence, note, expected, idempotencyKey } = parsed.data;
    if (note.trim().length > QUOTE_NOTE_MAX_LENGTH) {
      return refused("invalid", COPY.errors.noteTooLong(QUOTE_NOTE_MAX_LENGTH), 400);
    }

    let current: Awaited<ReturnType<typeof getAdminDelivery>>;
    try {
      current = await getAdminDelivery(lotId);
    } catch (error) {
      if (error instanceof Error && error.message === "forbidden") {
        return refused("forbidden", COPY.denied.title, 403);
      }
      return refused("unavailable", COPY.failed.unavailable, 503);
    }
    const drift = quoteDrift(expected, current);
    const body = quoteRequestBody({ pence, note });
    // A retry after an answer that never arrived: the price on the quote is already this one.
    if (
      drift === "already_quoted" &&
      current?.quote.amountMinor === pence &&
      (current.quote.note ?? null) === body.note
    ) {
      revalidatePath(DELIVERIES_PATH);
      return actionSuccess({ lotId });
    }
    if (drift !== "none") {
      revalidatePath(DELIVERIES_PATH);
      return drift === "already_quoted"
        ? refused("already_quoted", COPY.alreadyQuoted.title, 409, {
            amountMinor: current?.quote.amountMinor ?? null,
          })
        : refused("quote_changed", COPY.stale.title, 409);
    }

    const res = await authedServerFetch(
      `/admin/lot-fulfilment/${encodeURIComponent(lotId)}/delivery-quote`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
        body: JSON.stringify(body),
      },
    ).catch(() => null);
    if (!res) return refused("unavailable", COPY.failed.unavailable, 503);
    if (res.ok) {
      revalidatePath(DELIVERIES_PATH);
      return actionSuccess({ lotId });
    }
    if (await isStaffStepUpResponse(res)) return stepUpRequiredFailure();
    const answer = (await res.json().catch(() => ({}))) as { error?: unknown; code?: unknown };
    const code = typeof answer.code === "string" ? answer.code : answer.error;
    if (typeof code === "string" && STALE_CODES.has(code)) {
      revalidatePath(DELIVERIES_PATH);
      return refused("quote_changed", COPY.stale.title, 409);
    }
    if (code === "idempotency_in_progress") return refused("in_progress", COPY.failed.busy, 409);
    if (res.status === 403 || res.status === 401) {
      return refused("forbidden", COPY.denied.title, 403);
    }
    if (res.status === 400 || res.status === 422) {
      return refused("invalid", COPY.errors.priceInvalid, 400);
    }
    return refused("unavailable", COPY.failed.unavailable, res.status >= 500 ? res.status : 502);
  });
}
