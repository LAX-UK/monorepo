import { PageSkeleton } from "@auction/ui/components/page-skeleton";

export default function NotificationsLoading() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <PageSkeleton variant="table" />
    </div>
  );
}
