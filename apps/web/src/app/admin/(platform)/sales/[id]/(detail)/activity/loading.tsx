import { CatalogDetailTabPanel } from "@/components/admin/catalog";

export default function AdminSaleActivityLoading() {
  return (
    <CatalogDetailTabPanel title="Activity" description="Loading audit timeline…">
      <div className="space-y-4">
        {["a", "b", "c", "d"].map((key) => (
          <div
            key={key}
            className="h-20 animate-pulse rounded-lg border border-border-hairline/40 bg-surface-container-low/50"
          />
        ))}
      </div>
    </CatalogDetailTabPanel>
  );
}
