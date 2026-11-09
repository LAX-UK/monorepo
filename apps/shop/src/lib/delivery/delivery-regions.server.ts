import { fetchPublicDeliveryRegions } from "@/lib/shop-api.server";
import type { PublicDeliveryRegions } from "@auction/shop-contracts";
import * as Sentry from "@sentry/nextjs";

/**
 * The delivery regions for the delivery page, or `null` when they cannot be read. The page shows
 * what it can without them, so a failure is not thrown; it is logged and reported, because a page
 * that quietly drops its times would otherwise go unnoticed.
 */
export async function readDeliveryRegions(): Promise<PublicDeliveryRegions | null> {
  try {
    return await fetchPublicDeliveryRegions();
  } catch (error) {
    console.warn("[shop] delivery regions read failed (server-side)", {
      reason: error instanceof Error ? error.name : "unknown",
    });
    Sentry.captureException(error, { tags: { area: "delivery-regions" } });
    return null;
  }
}
