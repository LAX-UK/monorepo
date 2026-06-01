import { FinanceListPageSkeleton } from "@/components/admin/finance/finance-list-states";

export default function PayoutsLoading() {
  return (
    <FinanceListPageSkeleton
      title="Payouts"
      description="Loading payouts…"
      kpiTiles={4}
      tableRows={8}
      tableColumns={7}
      showReadinessBand
    />
  );
}
