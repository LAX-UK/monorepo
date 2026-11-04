import { artCatalogueApiServerUrl } from "@/lib/art-catalogue.server";
import {
  type ReleaseAlertUnsubscribePreview,
  isReleaseAlertToken,
  parseReleaseAlertUnsubscribePreview,
} from "@auction/shop-contracts";

const TIMEOUT_MS = 2500;

export type AlertStopPreviewResult =
  | { status: "ok"; preview: ReleaseAlertUnsubscribePreview }
  | { status: "invalid" }
  | { status: "failed" };

export type AlertStopResult = { status: "ok" } | { status: "invalid" } | { status: "failed" };

/** What a stop link in a lax.art email would stop, read with the token alone (no sign-in). */
export async function previewAlertStop(token: string): Promise<AlertStopPreviewResult> {
  if (!isReleaseAlertToken(token)) return { status: "invalid" };
  try {
    const response = await fetch(
      artCatalogueApiServerUrl(`/v1/email-alerts/unsubscribe?token=${encodeURIComponent(token)}`),
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

/** Stops the emails the token's address gets from lax.art. Safe to repeat. */
export async function stopAlerts(token: string): Promise<AlertStopResult> {
  if (!isReleaseAlertToken(token)) return { status: "invalid" };
  try {
    const response = await fetch(artCatalogueApiServerUrl("/v1/email-alerts/unsubscribe"), {
      method: "POST",
      cache: "no-store",
      headers: { accept: "application/json", "content-type": "application/json" },
      body: JSON.stringify({ token }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (response.status === 404 || response.status === 400) return { status: "invalid" };
    return response.ok ? { status: "ok" } : { status: "failed" };
  } catch {
    return { status: "failed" };
  }
}
