import { HOME_FEATURE_SLOT_COPY, HOME_FEATURE_SLOT_ORDER } from "@/lib/home-features";
import { PageHeader, Skeleton } from "@auction/staff-ui";

/** The three lists' frames while they load, with their real titles, so nothing shifts. */
export default function FeaturedOnHomeLoading() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true">
      <PageHeader title="Featured on home" />
      <div className="flex w-full max-w-[1040px] flex-col gap-6">
        {HOME_FEATURE_SLOT_ORDER.map((slot) => (
          <section
            key={slot}
            aria-label={HOME_FEATURE_SLOT_COPY[slot].title}
            className="flex flex-col gap-4 rounded-staff-lg border border-staff-line bg-staff-surface p-4 sm:p-6"
          >
            <div className="flex flex-col gap-2">
              <h2 className="font-staff text-staff-md font-semibold text-staff-fg">
                {HOME_FEATURE_SLOT_COPY[slot].title}
              </h2>
              <Skeleton className="h-4 w-full max-w-md" />
            </div>
            <div className="flex flex-col divide-y divide-staff-line-subtle rounded-staff-lg border border-staff-line">
              {[0, 1, 2].map((row) => (
                <div key={row} className="flex items-center gap-3 px-3 py-3">
                  <Skeleton className="size-8" />
                  <div className="flex flex-1 flex-col gap-1.5">
                    <Skeleton className="h-3.5 w-40" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
