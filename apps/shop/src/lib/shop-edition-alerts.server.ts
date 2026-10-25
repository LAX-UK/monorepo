import { shopApiServerUrl } from "@/lib/shop-api.server";
import { shopCommerceRequest } from "@/lib/shop-commerce-request.server";
import {
  type EditionAlert,
  type EditionAlertUnsubscribePreview,
  isEditionAlertToken,
  parseEditionAlertList,
  parseEditionAlertUnsubscribePreview,
  parseEditionAlertUnsubscribeResponse,
} from "@auction/shop-contracts";

const TIMEOUT_MS = 2500;

export type EditionAlertPreviewResult =
  | { status: "ok"; preview: EditionAlertUnsubscribePreview }
  | { status: "invalid" }
  | { status: "failed" };

export type EditionAlertUnsubscribeResult =
  | { status: "ok"; stopped: number }
  | { status: "invalid" }
  | { status: "failed" };

/** What an unsubscribe link would stop, read with the token alone (no session). */
export async function previewEditionAlertUnsubscribe(
  token: string,
): Promise<EditionAlertPreviewResult> {
  if (!isEditionAlertToken(token)) return { status: "invalid" };
  try {
    const response = await fetch(
      shopApiServerUrl(`/v1/alerts/unsubscribe?token=${encodeURIComponent(token)}`),
      {
        cache: "no-store",
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      },
    );
    if (response.status === 404 || response.status === 400) return { status: "invalid" };
    if (!response.ok) return { status: "failed" };
    return { status: "ok", preview: parseEditionAlertUnsubscribePreview(await response.json()) };
  } catch {
    return { status: "failed" };
  }
}

/** Stops every waiting alert for the token's address. Safe to repeat. */
export async function unsubscribeEditionAlerts(
  token: string,
): Promise<EditionAlertUnsubscribeResult> {
  if (!isEditionAlertToken(token)) return { status: "invalid" };
  try {
    const response = await fetch(shopApiServerUrl("/v1/alerts/unsubscribe"), {
      method: "POST",
      cache: "no-store",
      headers: { accept: "application/json", "content-type": "application/json" },
      body: JSON.stringify({ token }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (response.status === 404 || response.status === 400) return { status: "invalid" };
    if (!response.ok) return { status: "failed" };
    const body = parseEditionAlertUnsubscribeResponse(await response.json());
    return { status: "ok", stopped: body.stopped };
  } catch {
    return { status: "failed" };
  }
}

export type EditionAlertListResult =
  | { status: "ok"; alerts: EditionAlert[] }
  | { status: "unauthorized" }
  | { status: "failed" };

/** The signed-in shopper's waiting alerts, for Your orders. */
export async function listEditionAlerts(): Promise<EditionAlertListResult> {
  try {
    const response = await shopCommerceRequest("/commerce/me/alerts", {
      headers: { accept: "application/json" },
    });
    if (response.status === 401) return { status: "unauthorized" };
    if (!response.ok) return { status: "failed" };
    return { status: "ok", alerts: parseEditionAlertList(await response.json()).items };
  } catch {
    return { status: "failed" };
  }
}
