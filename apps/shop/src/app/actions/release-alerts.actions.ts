"use server";

import { commerceErrorMessage } from "@/lib/commerce-error-message";
import { fetchShopCommerceCsrfForMutation } from "@/lib/shop-commerce-mutation.server";
import { shopCommerceRequest } from "@/lib/shop-commerce-request.server";
import { confirmReleaseAlerts, unsubscribeReleaseAlerts } from "@/lib/shop-release-alerts.server";
import { parseReleaseAlertSubscribeResponse } from "@auction/shop-contracts";
import { redirect } from "next/navigation";

/**
 * What asking for release alerts did. `invalid` is an address that cannot be used, `limited` is
 * too many requests, and `failed` is anything else; each reads differently in the form.
 */
export type ReleaseAlertSubscribeResult =
  | { ok: true; status: "check_email" | "subscribed"; restarted: boolean }
  | { ok: false; kind: "invalid" | "limited" | "failed"; message: string };

export type ReleaseAlertStopResult = { ok: true } | { ok: false; message: string };

const SAVE_FAILED = "We could not save that just now. Try again in a moment.";
const STOP_FAILED = "We could not stop the alerts just now. Try again in a moment.";
const INVALID_EMAIL = "Enter an email address like name@example.com";

async function readJson(response: Response): Promise<unknown> {
  return response.json().catch(() => ({}));
}

function failure(status: number, body: unknown): ReleaseAlertSubscribeResult {
  const record = (body ?? {}) as { error?: string; code?: string };
  if (status === 400 && record.error === "validation_failed") {
    return { ok: false, kind: "invalid", message: INVALID_EMAIL };
  }
  if (status === 429) {
    return {
      ok: false,
      kind: "limited",
      message: "That is a lot of requests from here. Wait a few minutes, then try again.",
    };
  }
  return { ok: false, kind: "failed", message: commerceErrorMessage(body, SAVE_FAILED) };
}

/**
 * Asks for release alerts. A visitor gives an address and is sent a confirmation email; a signed-in
 * shopper is subscribed with the account's address and `email` is ignored. `website` is the
 * honeypot field, passed through untouched.
 */
export async function subscribeReleaseAlerts(input: {
  email?: string;
  website?: string;
  source: string;
}): Promise<ReleaseAlertSubscribeResult> {
  const csrf = await fetchShopCommerceCsrfForMutation();
  if (!csrf.ok) {
    return {
      ok: false,
      kind: "failed",
      message: commerceErrorMessage({ error: "csrf_failed" }, SAVE_FAILED),
    };
  }
  const email = input.email?.trim();
  const response = await shopCommerceRequest(
    "/commerce/release-alerts",
    {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/json" },
      body: JSON.stringify({
        source: input.source,
        ...(email ? { email } : {}),
        ...(input.website ? { website: input.website } : {}),
      }),
    },
    { applyCookies: true, csrfToken: csrf.token },
  );
  if (!response.ok) return failure(response.status, await readJson(response));
  try {
    const body = parseReleaseAlertSubscribeResponse(await response.json());
    return { ok: true, status: body.status, restarted: body.restarted === true };
  } catch {
    return { ok: false, kind: "failed", message: SAVE_FAILED };
  }
}

/** Stops the signed-in shopper's release alerts from the form. */
export async function stopReleaseAlerts(): Promise<ReleaseAlertStopResult> {
  const csrf = await fetchShopCommerceCsrfForMutation();
  if (!csrf.ok) {
    return { ok: false, message: commerceErrorMessage({ error: "csrf_failed" }, STOP_FAILED) };
  }
  const response = await shopCommerceRequest(
    "/commerce/me/release-alerts",
    { method: "DELETE", headers: { accept: "application/json" } },
    { applyCookies: true, csrfToken: csrf.token },
  );
  if (!response.ok) {
    return { ok: false, message: commerceErrorMessage(await readJson(response), STOP_FAILED) };
  }
  return { ok: true };
}

/** The button on the confirmation page: opening the email's link alone confirms nothing. */
export async function confirmReleaseAlertsFromEmail(formData: FormData): Promise<void> {
  const token = String(formData.get("token") ?? "");
  const result = await confirmReleaseAlerts(token);
  redirect(`/release-alerts/confirm?${new URLSearchParams({ token, result: result.status })}`);
}

/** The button on the stop page. The token in the email is the only credential. */
export async function stopReleaseAlertsFromEmail(formData: FormData): Promise<void> {
  const token = String(formData.get("token") ?? "");
  const result = await unsubscribeReleaseAlerts(token);
  const outcome = result.status === "ok" ? "stopped" : result.status;
  redirect(`/release-alerts/stop?${new URLSearchParams({ token, result: outcome })}`);
}
