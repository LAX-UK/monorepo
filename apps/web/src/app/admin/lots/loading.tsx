import { PageSkeleton } from "@auction/ui/components/page-skeleton";

export default function AdminLotsLoading() {
  return (
    <div className="mx-auto w-full max-w-[var(--container-inner,1376px)] space-y-6 py-6">
      <PageSkeleton variant="table" />
    </div>
  );
}
