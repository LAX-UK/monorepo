import { PageHeader, Skeleton } from "@auction/staff-ui";

export default function SaleroomHubLoading() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading the saleroom">
      <PageHeader
        title="Saleroom"
        description="Run the floor for live sales, or open a sale's console to check bidders in."
      />
      <Skeleton className="h-24 w-full rounded-staff-lg" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Skeleton className="h-48 rounded-staff-lg" />
        <Skeleton className="h-48 rounded-staff-lg" />
        <Skeleton className="h-48 rounded-staff-lg" />
      </div>
    </div>
  );
}
