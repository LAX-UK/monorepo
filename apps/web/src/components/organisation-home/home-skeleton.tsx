import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { DashboardPageHeader } from "@/components/dashboard/primitives/dashboard-page-header";
import { Skeleton } from "@auction/ui/components/skeleton";
import { HomePanel } from "./home-section";

const TASKS = ["a", "b"] as const;
const FIGURES = ["a", "b", "c", "d"] as const;
const ROWS = ["a", "b", "c"] as const;

function SectionHeading() {
  return (
    <div className="flex min-h-11 items-center">
      <Skeleton className="h-5 w-32" />
    </div>
  );
}

/**
 * Home while it loads, in Home's own shape: "Needs you" rows, the figures as cells of one card,
 * then a list. The title shows at once; heights are reserved so nothing jumps when data lands.
 */
export function HomeSkeleton() {
  return (
    <DashboardPage>
      <DashboardPageHeader title="Home" className="hidden lg:mb-6 lg:flex" />
      <output aria-label="Loading Home" className="flex flex-col gap-8 md:gap-10">
        <div className="space-y-3">
          <SectionHeading />
          <HomePanel className="divide-y divide-border-hairline">
            {TASKS.map((key) => (
              <div
                key={key}
                className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5"
              >
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <Skeleton className="h-4 w-56 max-w-full" />
                  <Skeleton className="h-3.5 w-80 max-w-full" />
                </div>
                <Skeleton className="h-10 w-full rounded-md sm:w-28" />
              </div>
            ))}
          </HomePanel>
        </div>
        <div className="space-y-3">
          <SectionHeading />
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border-hairline bg-border-hairline lg:grid-cols-4">
            {FIGURES.map((key) => (
              <div
                key={key}
                className="flex min-h-28 flex-col gap-3 bg-surface-container-lowest p-4 sm:p-5"
              >
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="h-7 w-28" />
                <Skeleton className="mt-auto h-3 w-20" />
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-3">
          <SectionHeading />
          <HomePanel className="divide-y divide-border-hairline">
            {ROWS.map((key) => (
              <div key={key} className="flex min-h-14 items-center gap-4 px-4 py-3 sm:px-5">
                <Skeleton className="h-3.5 w-20" />
                <Skeleton className="h-3.5 w-56 max-w-full flex-1 sm:flex-none" />
              </div>
            ))}
          </HomePanel>
        </div>
      </output>
    </DashboardPage>
  );
}
