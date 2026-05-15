import { PageSkeleton } from "@auction/ui/components/page-skeleton";

export default function AdminSaleDetailLoading() {
  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 py-6">
      <PageSkeleton variant="dashboard" />
    </div>
  );
}
