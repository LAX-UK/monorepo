import { AdminFailedPage } from "@/components/admin-fetch-state";
import { AdminListCursorNav } from "@/components/admin-list-cursor-nav";
import { AdjustMerchandiseStockForm } from "@/components/admin-staff-action-forms.client";
import { MerchandiseStaffListTable } from "@/components/admin-staff-list-tables.client";
import { adminListPath } from "@/server/application/admin-list-path";
import { fetchAdminJson } from "@/server/application/load-admin-data";
import { PageHeader } from "@auction/ui";
import { redirect } from "next/navigation";

type MerchandiseList = {
  items: Array<{
    productId: string;
    slug: string;
    title: string;
    variantCount: number;
    fromPricePence: number | null;
    totalOnHand: number;
  }>;
  nextCursor: string | null;
};

export const metadata = { title: "Products" };

export default async function ShopAdminMerchandisePage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string }>;
}) {
  const { cursor } = await searchParams;
  const result = await fetchAdminJson<MerchandiseList>(
    adminListPath("merchandise/products", { cursor }),
  );
  if (result.status === "unauthorized") redirect("/login");
  if (result.status !== "ok") {
    return <AdminFailedPage title="Products" status={result.status} />;
  }

  return (
    <div>
      <PageHeader
        title="Products"
        description="Shop products with their variants and stock on hand."
      />
      <div className="mb-6">
        <AdjustMerchandiseStockForm />
      </div>
      <MerchandiseStaffListTable items={result.data.items} />
      <AdminListCursorNav
        cursor={cursor}
        pathname="/merchandise"
        nextCursor={result.data.nextCursor}
      />
    </div>
  );
}
