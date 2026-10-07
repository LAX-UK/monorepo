import { AdminFetchState } from "@/components/admin-fetch-state";
import { AdminListCursorNav } from "@/components/admin-list-cursor-nav";
import { CreateOriginalSaleForm } from "@/components/admin-staff-action-forms.client";
import { AdminTable } from "@/components/shop-admin-shell";
import { formatAdminDetailDateTime, formatAdminDetailGbpPence } from "@/lib/admin-detail-format";
import { adminListPath } from "@/server/application/admin-list-path";
import { fetchAdminJson } from "@/server/application/load-admin-data";
import { redirect } from "next/navigation";

type OriginalSaleList = {
  items: Array<{
    saleId: string;
    artworkId: string;
    artworkTitle: string;
    status: string;
    salePricePence: number;
    createdAt: string;
  }>;
  nextCursor: string | null;
};

export default async function ShopAdminOriginalSalesPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string }>;
}) {
  const { cursor } = await searchParams;
  const result = await fetchAdminJson<OriginalSaleList>(
    adminListPath("original-sales", { cursor }),
  );
  if (result.status === "unauthorized") redirect("/login");
  if (result.status !== "ok") {
    return (
      <div>
        <h1 className="mb-6 text-2xl font-semibold">Original sales</h1>
        <AdminFetchState status={result.status} />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">Original sales</h1>
      <CreateOriginalSaleForm />
      <section>
        <h2 className="mb-3 text-lg font-medium">Reservations</h2>
        <AdminTable
          columns={["Artwork", "Price", "Status", "Created"]}
          rows={result.data.items.map((row) => [
            row.artworkTitle,
            formatAdminDetailGbpPence(row.salePricePence),
            row.status,
            formatAdminDetailDateTime(row.createdAt),
          ])}
        />
        <AdminListCursorNav pathname="/original-sales" nextCursor={result.data.nextCursor} />
      </section>
    </div>
  );
}
