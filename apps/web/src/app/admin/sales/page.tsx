import {
  type AdminSaleTableRow,
  AdminSalesDataTable,
} from "@/components/admin/admin-sales-data-table";
import { TableScroll } from "@/components/ui/table-scroll";
import { DisplayHeading } from "@/components/ui/typography";
import { getAdminSalesList } from "@/lib/data/http/admin.server";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import { EmptyState } from "@auction/ui/components/empty-state";
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
    <div className="mx-auto w-full max-w-[var(--container-inner,1376px)] space-y-8">
      <DisplayHeading as="h1" className="text-4xl text-brand-900 dark:text-on-surface">
        Sales
      </DisplayHeading>
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
        <p className="max-w-2xl font-body text-sm text-on-surface-variant">
          Umbrella sessions grouping catalogued lots. Create drafts, attach standalone lots,
          publish, or cancel from each sale page.
        </p>
        <Link
          href="/admin/sales/new"
          className="shrink-0 font-label text-xs font-bold uppercase tracking-widest text-primary underline-offset-4 hover:underline"
        >
          New sale
        </Link>
      </div>

      {err ? (
        <Alert variant="destructive">
          <AlertTitle>Could not load sales</AlertTitle>
          <AlertDescription>{err}</AlertDescription>
        </Alert>
      ) : null}

      {!err && rows.length === 0 ? (
        <EmptyState
          title="No sales yet"
          description="Create a sale to group lots for a session or season."
          action={
            <Link
              href="/admin/sales/new"
              className="inline-flex items-center justify-center rounded-md bg-gradient-to-br from-primary to-primary-container px-8 py-3 font-label text-xs font-semibold uppercase tracking-[0.3em] text-on-primary shadow-sm hover:opacity-95"
            >
              New sale
            </Link>
          }
        />
      ) : null}

      {!err && rows.length > 0 ? (
        <TableScroll>
          <AdminSalesDataTable rows={saleRows} />
        </TableScroll>
      ) : null}
    </div>
  );
}
