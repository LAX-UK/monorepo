import { DetailBoardShell } from "@/components/admin/catalog/detail-board";

export default function AdminSaleActivityLoading() {
  return (
    <DetailBoardShell title="Activity" description="Loading audit timeline…">
      <div className="space-y-4">
        {["a", "b", "c", "d"].map((key) => (
          <div
            key={key}
            className="h-20 animate-pulse rounded-lg border border-shell-stroke/40 bg-surface-container-low/50"
          />
        ))}
      </div>
    </DetailBoardShell>
  );
}
