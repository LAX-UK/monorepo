import { AdminFailedPage } from "@/components/admin-fetch-state";
import { FulfilmentList } from "@/components/orders/fulfilment-list.client";
import { adminListPath } from "@/server/application/admin-list-path";
import { fetchAdminJson } from "@/server/application/load-admin-data";
import type { AdminFulfilmentList } from "@auction/shop-contracts";
import { PageHeader } from "@auction/staff-ui";
import { redirect } from "next/navigation";

export const metadata = { title: "Fulfilment" };

export default async function ShopAdminFulfilmentPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string }>;
}) {
  const { cursor } = await searchParams;
  const result = await fetchAdminJson<AdminFulfilmentList>(adminListPath("fulfilment", { cursor }));
  if (result.status === "unauthorized") redirect("/login");
  if (result.status !== "ok") {
    return <AdminFailedPage title="Fulfilment" status={result.status} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Fulfilment"
        description="What is still to be shipped or collected. Open a row to move its order on, record tracking or record possession."
      />
      <FulfilmentList page={result.data} cursor={cursor ?? null} />
    </div>
  );
}
