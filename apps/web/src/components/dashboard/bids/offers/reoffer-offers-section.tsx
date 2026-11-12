import { ReofferOfferRows } from "@/components/dashboard/bids/offers/reoffer-offer-rows";
import { resolveSaleTitles } from "@/lib/data/sale-titles.server";
import { listBidderReoffers } from "@/lib/reoffer/bidder-reoffer.server";
import { bidderReofferRows } from "@/lib/reoffer/bidder-reoffer.vm";

/**
 * The offers waiting on the account's answer, read on their own so a failure leaves the bids
 * working. Nothing renders when there are none.
 */
export async function ReofferOffersSection() {
  const views = await listBidderReoffers();
  const now = new Date();
  const saleTitleById = await resolveSaleTitles(views.map((view) => view.saleId));
  const rows = bidderReofferRows(views, now, saleTitleById);
  return <ReofferOfferRows rows={rows} />;
}
