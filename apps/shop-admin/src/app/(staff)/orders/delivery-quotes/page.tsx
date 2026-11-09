import { AdminFailedPage } from "@/components/admin-fetch-state";
import { DeliveryQuotesView } from "@/components/delivery-quotes/delivery-quotes-view.client";
import { parseDeliveryQuoteView } from "@/lib/delivery-quotes";
import { fetchAdminJson, loadAdminSession } from "@/server/application/load-admin-data";
import type { AdminDeliveryQuoteList } from "@auction/shop-contracts";
import { DELIVERY_QUOTES_WRITE_CAPABILITY } from "@auction/shop-domain";
import { redirect } from "next/navigation";

const TITLE = "Delivery quotes";

export const metadata = { title: TITLE };

export default async function DeliveryQuotesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const view = parseDeliveryQuoteView((await searchParams).view);
  const [quotes, session] = await Promise.all([
    fetchAdminJson<AdminDeliveryQuoteList>(`orders/delivery-quotes?view=${view}`),
    loadAdminSession(),
  ]);
  if (quotes.status === "unauthorized" || session.status === "unauthorized") {
    redirect("/login");
  }
  if (quotes.status !== "ok") {
    return <AdminFailedPage title={TITLE} status={quotes.status} />;
  }
  const canWrite =
    session.status === "ok" && session.data.capabilities.includes(DELIVERY_QUOTES_WRITE_CAPABILITY);

  return <DeliveryQuotesView view={view} data={quotes.data} canWrite={canWrite} />;
}
