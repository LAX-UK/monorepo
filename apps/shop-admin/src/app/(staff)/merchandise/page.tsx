import { AdminFetchState } from "@/components/admin-fetch-state";
import { AdminListCursorNav } from "@/components/admin-list-cursor-nav";
import { AdjustMerchandiseStockForm } from "@/components/admin-staff-action-forms.client";
import { MerchandiseStaffListTable } from "@/components/admin-staff-list-tables.client";
import { adminListPath } from "@/server/application/admin-list-path";
import { fetchAdminJson } from "@/server/application/load-admin-data";
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
    return (
      <div>
        <h1 className="mb-6 text-2xl font-semibold">Merchandise</h1>
        <AdminFetchState status={result.status} />
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">Merchandise</h1>
      <div className="mb-6">
        <AdjustMerchandiseStockForm />
      </div>
      <MerchandiseStaffListTable items={result.data.items} />
      <AdminListCursorNav pathname="/merchandise" nextCursor={result.data.nextCursor} />
    </div>
  );
}
