import { FinanceListPageSkeleton } from "@/components/admin/finance/finance-list-states";

export default function DisputesLoading() {
  return (
    <FinanceListPageSkeleton
      title="Payment disputes"
      description="Loading disputes…"
      kpiTiles={0}
      showFilterBar={false}
      tableRows={8}
      tableColumns={5}
    />
  );
}
