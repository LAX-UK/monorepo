import { ACCOUNTING_DESCRIPTION } from "@/lib/admin/finance/accounting-queue.vm";
import { ListPageSkeleton } from "@auction/staff-ui";

export default function AccountingLoading() {
  return (
    <ListPageSkeleton
      title="Accounting"
      description={ACCOUNTING_DESCRIPTION}
      columns={["Document", "Status", "Last problem", "Company", "Amount", "Attempts", "Updated"]}
    />
  );
}
