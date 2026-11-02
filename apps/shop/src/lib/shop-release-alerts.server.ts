import { shopApiServerUrl } from "@/lib/shop-api.server";
import { shopCommerceRequest } from "@/lib/shop-commerce-request.server";
import { loadShopViewerState } from "@/lib/shop-viewer-state.server";
import {
  type ReleaseAlertConfirmResponse,
  type ReleaseAlertUnsubscribePreview,
  isReleaseAlertToken,
  parseReleaseAlertConfirmResponse,
  parseReleaseAlertStatus,
  parseReleaseAlertUnsubscribePreview,
} from "@auction/shop-contracts";
import { cache } from "react";

const TIMEOUT_MS = 2500;

/**
 * Who is looking at a release alerts form: a visitor, or a signed-in shopper whose verified
 * address is used and who may already be on the list.
 */
export type ReleaseAlertViewer =
  | { kind: "guest" }
  | { kind: "account"; email: string; subscribed: boolean };

async function readSubscribed(): Promise<boolean | null> {
  try {
    const response = await shopCommerceRequest("/commerce/me/release-alerts", {
      headers: { accept: "application/json" },
    });
    if (!response.ok) return null;
    return parseReleaseAlertStatus(await response.json()).subscribed;
  } catch {
    return null;
  }
}

/**
 * A signed-in shopper with a verified address is subscribed in one step; anyone else, including a
 * shopper whose address is not verified or whose sign-in has lapsed, confirms by email like a
 * visitor.
 */
export const loadReleaseAlertViewer = cache(async (): Promise<ReleaseAlertViewer> => {
  const viewer = await loadShopViewerState();
  if (viewer.kind !== "authenticated" || viewer.emailVerified !== true || !viewer.email) {
    return { kind: "guest" };
  }
  const subscribed = await readSubscribed();
  return subscribed === null
    ? { kind: "guest" }
    : { kind: "account", email: viewer.email, subscribed };
});

export type ReleaseAlertPreviewResult =
  | { status: "ok"; preview: ReleaseAlertUnsubscribePreview }
  | { status: "invalid" }
  | { status: "failed" };

export type ReleaseAlertConfirmResult =
  | { status: ReleaseAlertConfirmResponse["outcome"] }
  | { status: "invalid" }
  | { status: "failed" };

export type ReleaseAlertStopResult =
  | { status: "ok" }
  | { status: "invalid" }
  | { status: "failed" };

/** What an unsubscribe link would stop, read with the token alone (no session). */
export async function previewReleaseAlertUnsubscribe(
  token: string,
): Promise<ReleaseAlertPreviewResult> {
  if (!isReleaseAlertToken(token)) return { status: "invalid" };
  try {
    const response = await fetch(
      shopApiServerUrl(`/v1/release-alerts/unsubscribe?token=${encodeURIComponent(token)}`),
      {
        cache: "no-store",
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      },
    );
    if (response.status === 404 || response.status === 400) return { status: "invalid" };
    if (!response.ok) return { status: "failed" };
    return { status: "ok", preview: parseReleaseAlertUnsubscribePreview(await response.json()) };
  } catch {
    return { status: "failed" };
  }
}

async function postToken(path: string, token: string): Promise<Response | null> {
  try {
    return await fetch(shopApiServerUrl(path), {
      method: "POST",
      cache: "no-store",
      headers: { accept: "application/json", "content-type": "application/json" },
      body: JSON.stringify({ token }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    return null;
  }
}

/** Confirms the address a confirmation email was sent to. Safe to repeat. */
export async function confirmReleaseAlerts(token: string): Promise<ReleaseAlertConfirmResult> {
  if (!isReleaseAlertToken(token)) return { status: "invalid" };
  const response = await postToken("/v1/release-alerts/confirm", token);
  if (!response) return { status: "failed" };
  if (response.status === 404 || response.status === 400) return { status: "invalid" };
  if (!response.ok) return { status: "failed" };
  try {
    return { status: parseReleaseAlertConfirmResponse(await response.json()).outcome };
  } catch {
    return { status: "failed" };
  }
}

/** Stops the alerts for the token's address. Safe to repeat. */
export async function unsubscribeReleaseAlerts(token: string): Promise<ReleaseAlertStopResult> {
  if (!isReleaseAlertToken(token)) return { status: "invalid" };
  const response = await postToken("/v1/release-alerts/unsubscribe", token);
  if (!response) return { status: "failed" };
  if (response.status === 404 || response.status === 400) return { status: "invalid" };
  return response.ok ? { status: "ok" } : { status: "failed" };
}
