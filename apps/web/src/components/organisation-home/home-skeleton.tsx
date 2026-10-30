import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { DashboardPageHeader } from "@/components/dashboard/primitives/dashboard-page-header";
import { Skeleton } from "@auction/ui/lax";
import { HomePanel } from "./home-section";

const TASKS = ["a", "b", "c"] as const;
const FIGURES = ["a", "b", "c", "d"] as const;
const ROWS = ["a", "b", "c"] as const;

function SectionHeading() {
  return (
    <div className="mb-3 flex min-h-6 items-center">
      <Skeleton className="h-4 w-32" />
    </div>
  );
}

/**
 * Home while it loads, in Home's own shape: "Needs you" rows, the figures as cells of one card,
 * then the two columns. The title shows at once; heights are reserved so nothing jumps when the
 * data lands.
 */
export function HomeSkeleton() {
  return (
    <DashboardPage className="space-y-0 md:space-y-0">
      <DashboardPageHeader title="Home" className="mb-6 lg:mb-8" />
      <output aria-label="Loading Home" className="flex flex-col gap-8 lg:gap-10">
        <div>
          <SectionHeading />
          <HomePanel>
            {TASKS.map((key) => (
              <div
                key={key}
                className="flex min-h-16 items-center gap-4 border-t border-lax-line-subtle px-4 py-3 first:border-t-0 sm:pl-5"
              >
                <Skeleton className="size-10 shrink-0" />
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <Skeleton className="h-3.5 w-56 max-w-full" />
                  <Skeleton className="h-3 w-80 max-w-full" />
                </div>
                <Skeleton className="hidden h-9 w-24 sm:block" />
              </div>
            ))}
          </HomePanel>
        </div>
        <div>
          <SectionHeading />
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lax-card border border-lax-line bg-lax-line-subtle lg:grid-cols-4">
            {FIGURES.map((key) => (
              <div
                key={key}
                className="flex min-h-28 flex-col gap-3 bg-lax-surface px-6 py-5 lg:min-h-32"
              >
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-7 w-28" />
                <Skeleton className="mt-auto h-3 w-20" />
              </div>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:gap-6">
          <div>
            <SectionHeading />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Skeleton className="h-28 rounded-lax-card" />
              <Skeleton className="hidden h-28 rounded-lax-card sm:block" />
            </div>
          </div>
          <div>
            <SectionHeading />
            <HomePanel className="py-2">
              {ROWS.map((key) => (
                <div key={key} className="flex flex-col gap-2 px-5 py-2.5">
                  <Skeleton className="h-3.5 w-56 max-w-full" />
                  <Skeleton className="h-3 w-20" />
                </div>
              ))}
            </HomePanel>
          </div>
        </div>
      </output>
    </DashboardPage>
  );
}
