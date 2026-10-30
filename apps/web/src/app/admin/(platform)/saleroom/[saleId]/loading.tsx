import { PageHeader, Skeleton } from "@auction/staff-ui";

export default function SaleroomSaleLoading() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading the clerk console">
      <PageHeader title="Clerk console" />
      <Skeleton className="h-24 w-full rounded-staff-lg" />
      <Skeleton className="h-11 w-64 rounded-staff-sm" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-72 rounded-staff-lg" />
        <Skeleton className="h-72 rounded-staff-lg" />
      </div>
      <Skeleton className="h-40 w-full rounded-staff-lg" />
    </div>
  );
}
