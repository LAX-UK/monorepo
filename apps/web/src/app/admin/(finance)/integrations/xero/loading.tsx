import { FinancePanelPageSkeleton } from "@/components/admin/finance/finance-list-states";

export default function XeroLoading() {
  return (
    <FinancePanelPageSkeleton
      title="Xero"
      description="Loading integration…"
      className="max-w-[640px]"
    />
  );
}
