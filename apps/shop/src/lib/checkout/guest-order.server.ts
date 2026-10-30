import { shopCommerceRequest } from "@/lib/shop-commerce-request.server";
import { type GuestOrderView, parseGuestOrderView } from "@auction/shop-contracts";

export type GuestOrderFetchResult =
  | { status: "ok"; view: GuestOrderView }
  | { status: "empty" }
  | { status: "failed" };

/** The guest order the browser holds a token for (after checkout, or from the emailed link). */
export async function fetchCurrentGuestOrder(): Promise<GuestOrderFetchResult> {
  try {
    const response = await shopCommerceRequest("/commerce/guest-orders/current", {
      headers: { accept: "application/json" },
    });
    if (response.status === 404) return { status: "empty" };
    if (!response.ok) return { status: "failed" };
    const view = parseGuestOrderView(await response.json());
    return view ? { status: "ok", view } : { status: "failed" };
  } catch {
    return { status: "failed" };
  }
}

/**
 * Checks an emailed link. A good link leaves its token in an httpOnly cookie (set by Shop
 * Identity and copied onto this origin), so the order page never needs it in the URL.
 * Returns the link's state, or null when the link is unknown.
 */
export async function openGuestOrderLink(token: string): Promise<string | null> {
  try {
    const response = await shopCommerceRequest(
      `/commerce/guest-orders/links/${encodeURIComponent(token)}`,
      { headers: { accept: "application/json" } },
      { applyCookies: true },
    );
    if (!response.ok) return null;
    const view = parseGuestOrderView(await response.json());
    return view?.state ?? null;
  } catch {
    return null;
  }
}
