import { AppScreen } from "@/components/dashboard/dashboard-page";
import { EmptyState } from "@auction/ui/components/empty-state";
import { PageHeader } from "@auction/ui/components/page-header";
import Link from "next/link";

export default function AdminSaleroomHubPage() {
  return (
    <AppScreen className="space-y-6">
      <PageHeader
        title="Saleroom console"
        description="Pick a sale to run clerk actions: manual bids, hammer / pass / withdraw, broadcast notices, and undo stacks."
        className="border-0 pb-0"
      />
      <EmptyState
        title="Select a sale"
        description="Deep links use /admin/saleroom/[saleId]. Hook this picker to scheduled onsite sales when Phase 3 ships."
        action={
          <Link
            href="/admin/sales"
            className="inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-4 py-2 font-label text-xs font-semibold uppercase tracking-widest text-on-primary"
          >
            Go to sales
          </Link>
        }
      />
    </AppScreen>
  );
}
