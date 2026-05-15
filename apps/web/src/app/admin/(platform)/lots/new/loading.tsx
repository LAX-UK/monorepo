import { PageSkeleton } from "@auction/ui/components/page-skeleton";

export default function AdminNewLotLoading() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 py-6">
      <PageSkeleton variant="dashboard" />
    </div>
  );
}
