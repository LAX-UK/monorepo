import { Skeleton } from "@auction/staff-ui";

function SectionFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-staff-lg border border-staff-line bg-staff-surface">
      <div className="flex min-h-12 items-center border-b border-staff-line-subtle px-4 py-2.5">
        <Skeleton className="h-4 w-24" />
      </div>
      <div className="flex flex-col gap-4 p-4">{children}</div>
    </div>
  );
}

/** The cover tab's shape while it loads: slot cards, the editor, the previews and the home fields. */
export function SaleCoverSkeleton() {
  return (
    <output
      aria-busy="true"
      aria-label="Loading the cover and home settings"
      className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_440px]"
    >
      <div className="flex min-w-0 flex-col gap-6">
        <SectionFrame>
          <div className="grid gap-3 sm:grid-cols-3">
            {[0, 1, 2].map((slot) => (
              <Skeleton key={slot} className="h-14 w-full" />
            ))}
          </div>
          <Skeleton className="h-[260px] w-full" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        </SectionFrame>
        <SectionFrame>
          {[0, 1, 2].map((row) => (
            <Skeleton key={row} className="h-12 w-full" />
          ))}
        </SectionFrame>
      </div>
      <div className="flex min-w-0 flex-col gap-6">
        <SectionFrame>
          <Skeleton className="aspect-[1920/720] w-full" />
          <Skeleton className="aspect-[1440/640] w-full" />
          <Skeleton className="aspect-[375/340] w-3/5" />
        </SectionFrame>
        <SectionFrame>
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </SectionFrame>
      </div>
    </output>
  );
}
