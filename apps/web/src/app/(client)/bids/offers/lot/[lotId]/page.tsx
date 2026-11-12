import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import { CLIENT_ROUTES } from "@/lib/navigation/client-routes";
import { bidderReofferForLotHref, bidderReofferHref } from "@/lib/reoffer/bidder-reoffer-links";
import { listBidderReoffers } from "@/lib/reoffer/bidder-reoffer.server";
import { redirect } from "next/navigation";

type PageProps = { params: Promise<{ lotId: string }> };

/**
 * The address a notice about an offer opens: it names the lot, so this finds the account's offer
 * for it (the open one when there is one, else the latest) and goes there, or to Bids when the
 * account has none.
 */
export default async function BidderReofferForLotPage({ params }: PageProps) {
  const { lotId } = await params;
  await requireAuthenticatedUser({ shell: "client", loginNext: bidderReofferForLotHref(lotId) });
  const offers = (await listBidderReoffers()).filter((offer) => offer.lotId === lotId);
  // The list is newest first; an offer that is still open is the one the notice is about.
  const target = offers.find((offer) => offer.status === "offered") ?? offers[0];
  redirect(target ? bidderReofferHref(target.id) : CLIENT_ROUTES.bids);
}
