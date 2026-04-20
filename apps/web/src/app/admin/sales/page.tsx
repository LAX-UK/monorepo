import {
  type AdminSaleTableRow,
  AdminSalesDataTable,
} from "@/components/admin/admin-sales-data-table";
import { DisplayHeading } from "@/components/ui/typography";
import { getAdminSalesList } from "@/lib/data/http/admin.server";
import Link from "next/link";

export default async function AdminSalesPage() {
  let rows: Awaited<ReturnType<typeof getAdminSalesList>> = [];
  let err: string | null = null;
  try {
    rows = await getAdminSalesList({ limit: 100 });
  } catch (e) {
    err = e instanceof Error ? e.message : "Could not load sales.";
  }

  const saleRows: AdminSaleTableRow[] = rows.map(({ sale, lots }) => ({
    saleId: sale.id,
    title: sale.title,
    status: sale.status,
    lotCount: lots.length,
  }));

  return (
    <div className="max-w-5xl space-y-8">
      <DisplayHeading as="h1" className="text-4xl">
        Sales
      </DisplayHeading>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="font-body text-on-surface-variant">
          Umbrella sessions grouping catalogued lots. Create drafts, attach standalone lots,
          publish, or cancel from each sale page.
        </p>
        <Link
          href="/admin/sales/new"
          className="font-label text-xs font-bold uppercase tracking-widest text-primary underline-offset-4 hover:underline"
        >
          New sale
        </Link>
      </div>
      {err ? (
        <p className="text-sm text-error" role="alert">
          {err}
        </p>
      ) : rows.length === 0 ? (
        <p className="text-on-surface-variant">No sales found.</p>
      ) : (
        <AdminSalesDataTable rows={saleRows} />
      )}
    </div>
  );
}
