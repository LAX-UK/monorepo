import { FinanceListPageSkeleton } from "@/components/admin/finance/finance-list-states";

export default function ManualReviewLoading() {
  return (
    <FinanceListPageSkeleton
      title="Manual payment review"
      description="Loading manual review queue…"
      kpiTiles={0}
      showFilterBar={false}
      tableRows={6}
      tableColumns={4}
    />
  );
}
