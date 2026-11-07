import { loadPartyDeals } from "@/lib/private-sales/party-deals.server";
import { dealsForRole } from "@/lib/private-sales/party-deals.vm";
import { PrivateSaleRows } from "./private-sale-rows";

/** A buyer's private sales for Purchases, or a seller's for Consignments; nothing when there are none. */
export async function PrivateSalesPanel({ side }: { side: "buyer" | "seller" }) {
  const rows = dealsForRole(await loadPartyDeals(), side);
  return <PrivateSaleRows rows={rows} heading="Private sales" />;
}
