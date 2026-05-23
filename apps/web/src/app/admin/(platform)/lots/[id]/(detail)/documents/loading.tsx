import { Skeleton } from "@auction/ui/components/skeleton";

export default function LotDocumentsLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-6 w-36" />
        <Skeleton className="h-4 w-full max-w-lg" />
      </div>
      <Skeleton className="h-48 w-full rounded-xl" />
    </div>
  );
}
