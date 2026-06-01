import { FinanceListPageSkeleton } from "@/components/admin/finance/finance-list-states";

export default function PaymentsLoading() {
  return (
    <FinanceListPageSkeleton
      title="Payments"
      description="Loading payments…"
      kpiTiles={4}
      tableRows={10}
      tableColumns={6}
    />
  );
}
