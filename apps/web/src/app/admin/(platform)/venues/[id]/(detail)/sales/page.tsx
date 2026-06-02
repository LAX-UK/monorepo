import { CatalogDetailTabPanel } from "@/components/admin/catalog";
import { loadAdminVenueDetail } from "@/lib/admin/load-venue-detail";
import Link from "next/link";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function AdminVenueSalesPage({ params }: Props) {
  const { id } = await params;
  const { salesUsingCount } = await loadAdminVenueDetail(id);

  return (
    <CatalogDetailTabPanel
      title="Sales"
      description="Sales that reference this venue for onsite delivery."
    >
      {salesUsingCount > 0 ? (
        <div className="space-y-3">
          <p className="font-body text-sm text-on-surface">
            {salesUsingCount} sale{salesUsingCount !== 1 ? "s" : ""} reference this venue.
          </p>
          <Link
            href="/admin/sales?delivery=onsite"
            className="inline-flex items-center rounded-md border border-outline-variant/40 px-3 py-2 font-label text-xs font-semibold uppercase tracking-wide text-on-surface hover:bg-surface-container-low"
          >
            Browse onsite sales →
          </Link>
        </div>
      ) : (
        <p className="font-body text-sm text-on-surface-variant">
          No sales currently reference this venue. Select it during sale setup to associate onsite
          sales.
        </p>
      )}
    </CatalogDetailTabPanel>
  );
}
