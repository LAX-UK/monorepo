import { PageSkeleton } from "@auction/ui/components/page-skeleton";

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-[var(--container-inner,1376px)] px-4 py-6 md:px-8">
      <PageSkeleton variant="dashboard" />
    </div>
  );
}
