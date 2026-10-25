"use server";

import { commerceErrorMessage } from "@/lib/commerce-error-message";
import { fetchShopCommerceCsrfForMutation } from "@/lib/shop-commerce-mutation.server";
import { shopCommerceRequest } from "@/lib/shop-commerce-request.server";
import {
  SHOP_API_ERROR_CODES,
  parseEditionAlertCancelResponse,
  parseRegisterArtworkInterestResponse,
} from "@auction/shop-contracts";
import { revalidatePath } from "next/cache";

export type EditionAlertActionResult =
  | { ok: true; status: "registered" | "already_subscribed" }
  | { ok: false; message: string; field?: "email" };

export type EditionAlertStopResult = { ok: true } | { ok: false; message: string };

const SAVE_FAILED = "We could not save your alert. Try again in a moment.";
const STOP_FAILED = "We could not stop the alert. Try again in a moment.";

async function readJson(response: Response): Promise<unknown> {
  return response.json().catch(() => ({}));
}

function alertFailure(status: number, body: unknown): EditionAlertActionResult {
  const record = (body ?? {}) as { error?: string; code?: string };
  if (
    status === 400 &&
    (record.error === "validation_failed" || record.code === SHOP_API_ERROR_CODES.VALIDATION)
  ) {
    return {
      ok: false,
      field: "email",
      message: "Enter an email address in the correct format, like name@example.com",
    };
  }
  if (status === 429) {
    return { ok: false, message: "Too many requests from here. Try again in a few minutes." };
  }
  if (status === 409) {
    return { ok: false, message: "This edition is on sale again. Refresh the page to buy it." };
  }
  return { ok: false, message: commerceErrorMessage(body, SAVE_FAILED) };
}

/**
 * Asks to be emailed once if a sold-out edition comes back. Guests give an email address; a
 * signed-in shopper's alert goes to the account's address and `email` is ignored. `website` is
 * the honeypot field, passed through untouched.
 */
export async function registerEditionAlert(
  slug: string,
  input: { email?: string; website?: string } = {},
): Promise<EditionAlertActionResult> {
  const csrf = await fetchShopCommerceCsrfForMutation();
  if (!csrf.ok) {
    return { ok: false, message: commerceErrorMessage({ error: "csrf_failed" }, SAVE_FAILED) };
  }
  const email = input.email?.trim();
  const response = await shopCommerceRequest(
    `/commerce/artworks/${encodeURIComponent(slug)}/interest`,
    {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/json" },
      body: JSON.stringify({
        intent: "notify_me",
        ...(email ? { email } : {}),
        ...(input.website ? { website: input.website } : {}),
      }),
    },
    { applyCookies: true, csrfToken: csrf.token },
  );
  if (!response.ok) return alertFailure(response.status, await readJson(response));
  try {
    const body = parseRegisterArtworkInterestResponse(await response.json());
    revalidatePath("/account/orders");
    return { ok: true, status: body.status };
  } catch {
    return { ok: false, message: SAVE_FAILED };
  }
}

async function stopAlert(path: string): Promise<EditionAlertStopResult> {
  const csrf = await fetchShopCommerceCsrfForMutation();
  if (!csrf.ok) {
    return { ok: false, message: commerceErrorMessage({ error: "csrf_failed" }, STOP_FAILED) };
  }
  const response = await shopCommerceRequest(
    path,
    { method: "DELETE", headers: { accept: "application/json" } },
    { applyCookies: true, csrfToken: csrf.token },
  );
  if (!response.ok) {
    return { ok: false, message: commerceErrorMessage(await readJson(response), STOP_FAILED) };
  }
  try {
    parseEditionAlertCancelResponse(await response.json());
  } catch {
    return { ok: false, message: STOP_FAILED };
  }
  revalidatePath("/account/orders");
  return { ok: true };
}

/** Stops the signed-in shopper's alert for one edition, from its page. */
export async function stopEditionAlertForArtwork(slug: string): Promise<EditionAlertStopResult> {
  return stopAlert(`/commerce/me/alerts/artworks/${encodeURIComponent(slug)}`);
}

/** Stops one of the signed-in shopper's alerts, from Your orders. */
export async function stopEditionAlert(alertId: string): Promise<EditionAlertStopResult> {
  return stopAlert(`/commerce/me/alerts/${encodeURIComponent(alertId)}`);
}
