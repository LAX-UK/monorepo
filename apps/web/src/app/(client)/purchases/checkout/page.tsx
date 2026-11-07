import { redirectLegacyCheckout } from "@/lib/pay/pay-legacy-redirect.server";

type Props = { searchParams: Promise<{ lots?: string | string[]; payment?: string | string[] }> };

/** The old basket checkout: its lots are now paid on the Pay page. */
export default async function LegacyBasketCheckout({ searchParams }: Props) {
  const { lots, payment } = await searchParams;
  return redirectLegacyCheckout(lots, payment);
}
