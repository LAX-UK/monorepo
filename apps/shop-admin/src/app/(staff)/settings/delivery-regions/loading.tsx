import { PageHeader, Skeleton } from "@auction/staff-ui";

/** The two sections' frames while they load, so nothing shifts when the regions arrive. */
export default function DeliveryRegionsLoading() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true">
      <PageHeader title="Delivery regions" />
      <div className="flex w-full max-w-[1040px] flex-col gap-6">
        {["Regions", "Not delivered to"].map((title) => (
          <section
            key={title}
            aria-label={title}
            className="flex flex-col gap-4 rounded-staff-lg border border-staff-line bg-staff-surface p-4"
          >
            <h2 className="font-staff text-staff-md font-semibold text-staff-fg">{title}</h2>
            <Skeleton className="h-4 w-full max-w-md" />
            <Skeleton className="h-16 w-full" />
          </section>
        ))}
      </div>
    </div>
  );
}
