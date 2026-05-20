import { AdminEmptyState } from "@/components/admin/admin-empty-state";
import { AdminListAlert } from "@/components/admin/admin-list-alert";
import { AdminListPage } from "@/components/admin/admin-list-page";
import { AdminSaleroomHubBoard } from "@/components/admin/saleroom-hub-board";
import { getAdminSalesList } from "@/lib/data/http/admin.server";
import Link from "next/link";

export default async function AdminSaleroomHubPage() {
  let sales: Awaited<ReturnType<typeof getAdminSalesList>> = [];
  let loadError: string | null = null;
  try {
    sales = await getAdminSalesList({ limit: 50 });
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Could not load sales.";
  }

  const liveOrUpcoming = sales.filter(
    (row) => row.sale.status === "active" || row.sale.status === "scheduled",
  );

  const empty =
    !loadError && liveOrUpcoming.length === 0 ? (
      <AdminEmptyState
        title="No live or upcoming sales"
        description="Schedule or activate a sale to open the clerk console."
        action={
          <Link
            href="/admin/sales"
            className="inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-4 py-2 font-label text-xs font-semibold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-primary"
          >
            Go to sales
          </Link>
        }
      />
    ) : null;

  return (
    <AdminListPage
      title="Saleroom console"
      description="Pick a live or upcoming sale to open the clerk console."
      errorAlert={
        loadError ? <AdminListAlert title="Could not load sales">{loadError}</AdminListAlert> : null
      }
      view={
        !loadError && liveOrUpcoming.length > 0 ? (
          <AdminSaleroomHubBoard rows={liveOrUpcoming} />
        ) : null
      }
      empty={empty}
    />
  );
}
