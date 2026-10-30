import { openGuestOrderLink } from "@/lib/checkout/guest-order.server";
import { guestOrderLinkDestination } from "@/lib/checkout/guest-order.vm";

/**
 * The link in a guest's order email. The token is checked and kept in an httpOnly cookie, then
 * the browser moves on to the order page, so the token leaves the address bar and history and is
 * never sent on as a referrer.
 */
export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const state = /^[A-Za-z0-9_-]{43}$/.test(token) ? await openGuestOrderLink(token) : null;
  return new Response(null, {
    status: 303,
    headers: {
      location: guestOrderLinkDestination(state),
      "referrer-policy": "no-referrer",
      "cache-control": "private, no-store",
    },
  });
}
