import { PageSkeleton } from "@auction/ui/components/page-skeleton";

export default function DashboardBidsLoading() {
  return (
    <div className="mx-auto w-full max-w-[var(--container-inner,1376px)] py-6">
      <PageSkeleton variant="table" />
    </div>
  );
}
