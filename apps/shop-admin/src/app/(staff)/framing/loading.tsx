import { PageHeader, Skeleton } from "@auction/staff-ui";

/** The catalogue's frame while it loads, with its real title, so nothing shifts. */
export default function FramingLoading() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true">
      <PageHeader title="Framing" />
      <div className="flex flex-col divide-y divide-staff-line-subtle rounded-staff-lg border border-staff-line bg-staff-surface">
        {[0, 1, 2, 3].map((row) => (
          <div key={row} className="flex items-center gap-4 px-4 py-4">
            <div className="flex flex-1 flex-col gap-1.5">
              <Skeleton className="h-3.5 w-44" />
              <Skeleton className="h-3 w-72 max-w-full" />
            </div>
            <Skeleton className="hidden h-3.5 w-24 md:block" />
            <Skeleton className="h-5 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}
