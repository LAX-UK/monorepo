import { redirectLegacyCheckout } from "@/lib/pay/pay-legacy-redirect.server";
import { parsePayLots } from "@/lib/pay/pay-lots";
import { notFound } from "next/navigation";

type Props = { params: Promise<{ lotId: string }> };

/**
 * The old checkout of one lot, still the address in emails sent before the Pay page: a paid lot
 * opens its purchase, any other opens the Pay page.
 */
export default async function LegacyLotCheckout({ params }: Props) {
  const { lotId } = await params;
  if (parsePayLots(lotId).kind !== "lots") notFound();
  return redirectLegacyCheckout(lotId, `/purchases/checkout/${lotId}`);
}
