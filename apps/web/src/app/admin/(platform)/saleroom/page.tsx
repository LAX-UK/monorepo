import { AdminPanelPage } from "@/components/admin/admin-panel-page";
import { EmptyState } from "@auction/ui/components/empty-state";
import Link from "next/link";

export default function AdminSaleroomHubPage() {
  return (
    <AdminPanelPage
      title="Saleroom console"
      description="Pick a sale, then use the clerk console for go live, advance lot, hammer, and no sale. Sale-room events broadcast over websockets to joined clients."
    >
      <EmptyState
        title="Select a sale"
        description="From Sales, copy an active sale’s id into the URL as /admin/saleroom/{saleId} to open the clerk console."
        action={
          <Link
            href="/admin/sales"
            className="inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-4 py-2 font-label text-xs font-semibold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-primary"
          >
            Go to sales
          </Link>
        }
      />
    </AdminPanelPage>
  );
}
