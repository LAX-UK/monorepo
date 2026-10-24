"use server";

import type { PortalPayeeConnectSurface } from "@auction/shop-contracts";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getLaxAccountContainer } from "../container";
import type { AccountActionResult } from "../domain/account-action-result";
import {
  MAX_AVAILABLE_TO_SELL,
  MIN_AVAILABLE_TO_SELL,
  SALE_REQUEST_NOTE_MAX,
} from "../domain/selling/selling-editions.vm";
import { SELLING_ROUTES } from "../domain/selling/selling-routes";
import type { SessionHandle } from "../ports/portfolio-gateway";
import type { SellingWrite } from "../ports/selling-gateway";
import { loadAccountSessionHandle } from "./load-account-record";
import { forgetSellerAccess } from "./load-selling";

const UNAVAILABLE_MESSAGE =
  "We couldn't send that just now. Nothing was changed. Please try again in a moment.";

const requestSchema = z.object({
  artworkId: z.string().uuid(),
  requestedCount: z.number().int().min(MIN_AVAILABLE_TO_SELL).max(MAX_AVAILABLE_TO_SELL),
  note: z.string().trim().max(SALE_REQUEST_NOTE_MAX).optional(),
});

async function loadHandle(): Promise<SessionHandle | "no_session" | "unavailable"> {
  try {
    return (await loadAccountSessionHandle()) ?? "no_session";
  } catch (error) {
    console.error("account_session_load_failed", error);
    return "unavailable";
  }
}

function toResult(
  result: SellingWrite<unknown>,
  messages: { ok: string; conflict: string; notFound?: string },
): AccountActionResult {
  switch (result.status) {
    case "ok":
      return { status: "ok", message: messages.ok };
    case "signed_out":
      return { status: "reauth_required" };
    case "unavailable":
      return { status: "error", message: UNAVAILABLE_MESSAGE };
    case "rejected":
      if (result.reason === "conflict") return { status: "error", message: messages.conflict };
      if (result.reason === "not_found" && messages.notFound) {
        return { status: "error", message: messages.notFound };
      }
      return {
        status: "error",
        message: "LAX couldn't accept that request. Refresh the page and try again.",
      };
  }
}

/** Asks LAX to change how many editions of one artwork the person can sell. */
export async function requestSaleChangeAction(input: {
  artworkId: string;
  requestedCount: number;
  note?: string;
}): Promise<AccountActionResult> {
  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) {
    return {
      status: "error",
      message: `Choose between ${MIN_AVAILABLE_TO_SELL} and ${MAX_AVAILABLE_TO_SELL} editions, with a note of up to ${SALE_REQUEST_NOTE_MAX} characters.`,
    };
  }
  const handle = await loadHandle();
  if (handle === "no_session") return { status: "reauth_required" };
  if (handle === "unavailable") return { status: "error", message: UNAVAILABLE_MESSAGE };
  const { note, ...rest } = parsed.data;
  const result = await getLaxAccountContainer().selling.requestSaleChange(handle, {
    ...rest,
    ...(note ? { note } : {}),
  });
  if (result.status === "ok") {
    forgetSellerAccess(handle.record.subject);
    revalidatePath(SELLING_ROUTES.editions);
  }
  return toResult(result, {
    ok: "Request sent. LAX's answer will show on this page.",
    conflict: "You already have a request waiting for this artwork.",
  });
}

/** Withdraws a request LAX has not answered yet. */
export async function withdrawSaleRequestAction(requestId: string): Promise<AccountActionResult> {
  if (!z.string().uuid().safeParse(requestId).success) {
    return { status: "error", message: "That request could not be found." };
  }
  const handle = await loadHandle();
  if (handle === "no_session") return { status: "reauth_required" };
  if (handle === "unavailable") return { status: "error", message: UNAVAILABLE_MESSAGE };
  const result = await getLaxAccountContainer().selling.withdrawRequest(handle, requestId);
  if (result.status === "ok" || (result.status === "rejected" && result.reason === "conflict")) {
    revalidatePath(SELLING_ROUTES.editions);
  }
  return toResult(result, {
    ok: "Request withdrawn.",
    conflict: "LAX has already answered this request, so it can't be withdrawn.",
    notFound: "That request could not be found.",
  });
}

export type PayoutSessionResult =
  | { ok: true; clientSecret: string }
  | { ok: false; reason: "sign_in_required" | "unavailable" };

/** A short-lived Stripe session for the payout setup forms shown in the page. */
export async function createPayoutSessionAction(
  surface: PortalPayeeConnectSurface,
): Promise<PayoutSessionResult> {
  if (surface !== "onboarding" && surface !== "management") {
    return { ok: false, reason: "unavailable" };
  }
  const handle = await loadHandle();
  if (handle === "no_session") return { ok: false, reason: "sign_in_required" };
  if (handle === "unavailable") return { ok: false, reason: "unavailable" };
  const result = await getLaxAccountContainer().selling.createPayoutSession(handle, surface);
  if (result.status === "ok") return { ok: true, clientSecret: result.data.clientSecret };
  return { ok: false, reason: result.status === "signed_out" ? "sign_in_required" : "unavailable" };
}
