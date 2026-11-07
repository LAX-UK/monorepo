import { redirectLegacyCheckout } from "@/lib/pay/pay-legacy-redirect.server";
import { parsePayLots } from "@/lib/pay/pay-lots";
import { notFound } from "next/navigation";

type Props = {
  params: Promise<{ lotId: string }>;
  searchParams: Promise<{ payment?: string | string[] }>;
};

/**
 * The old checkout of one lot, still the address in emails sent before the Pay page and the
 * place single-lot payments return to: a paid lot opens its purchase, any other the Pay page.
 */
export default async function LegacyLotCheckout({ params, searchParams }: Props) {
  const { lotId } = await params;
  if (parsePayLots(lotId).kind !== "lots") notFound();
  return redirectLegacyCheckout(lotId, (await searchParams).payment);
}
