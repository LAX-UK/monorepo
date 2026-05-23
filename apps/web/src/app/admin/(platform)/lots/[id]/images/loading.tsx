import { Skeleton } from "@auction/ui/components/skeleton";

export default function LotImagesLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-4 w-full max-w-md" />
      </div>
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  );
}
