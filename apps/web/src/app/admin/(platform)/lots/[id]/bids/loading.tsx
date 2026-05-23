import { TableSkeleton } from "@auction/ui";

export default function LotBidsLoading() {
  return (
    <div className="space-y-6">
      <TableSkeleton rows={6} columns={4} />
    </div>
  );
}
