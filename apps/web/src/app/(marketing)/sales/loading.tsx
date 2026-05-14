import { cn } from "@auction/ui";

const pulse = "animate-pulse rounded bg-surface-container-high";

export default function SalesIndexLoading() {
  return (
    <main
      id="main-content"
      className="bg-page-bg pb-24 pt-[var(--header-height)] dark:bg-background"
      aria-busy="true"
      aria-label="Loading sales"
    >
      <div className="mx-auto w-full max-w-[1440px] px-4 sm:px-6 md:px-8 lg:px-8">
        <section className="pt-12 pb-8 sm:pt-16 sm:pb-10 lg:pt-20 lg:pb-10">
          <div className="flex flex-col gap-8 sm:gap-10 lg:gap-12">
            <div className="space-y-3">
              <div className={cn(pulse, "h-10 w-48 sm:h-12 sm:w-64")} />
              <div className={cn(pulse, "h-4 w-full max-w-xl")} />
            </div>

            <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 lg:gap-4">
              {(["a", "b", "c"] as const).map((k) => (
                <li
                  key={k}
                  className="min-h-[200px] rounded-lg bg-page-bg p-4 outline outline-1 -outline-offset-1 outline-outline-variant/60 sm:p-5 lg:p-6 dark:bg-surface-container-low"
                >
                  <div
                    className={cn(pulse, "h-full min-h-[120px] w-full rounded-md")}
                    aria-hidden
                  />
                </li>
              ))}
            </ul>

            <div className="w-full overflow-x-auto scroll-pl-4 scroll-pr-4 snap-x snap-mandatory [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="inline-flex min-w-full gap-5 border-b border-outline-variant pb-2 sm:gap-8 lg:gap-12">
                {(["a", "b", "c", "d", "e", "f"] as const).map((k) => (
                  <span
                    key={k}
                    className={cn(pulse, "snap-start h-10 w-24 shrink-0")}
                    aria-hidden
                  />
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-6">
              <div className="w-full overflow-x-auto pb-1 md:overflow-visible">
                <div className="inline-flex min-w-full gap-2 border-b border-outline-variant pb-2 md:flex-wrap">
                  {(["x", "y", "z"] as const).map((k) => (
                    <span
                      key={k}
                      className={cn(pulse, "h-10 w-28 shrink-0 rounded-full")}
                      aria-hidden
                    />
                  ))}
                </div>
              </div>

              <div className="pt-2 sm:pt-4">
                <div className="flex flex-col gap-8 lg:flex-row lg:gap-0">
                  <div className="hidden lg:block lg:w-[min(100%,441px)] lg:max-w-[441px] lg:pr-8">
                    <div className="space-y-4">
                      <div className={cn(pulse, "h-4 w-40")} />
                      {(["s1", "s2"] as const).map((k) => (
                        <div key={k} className={cn(pulse, "h-12 w-full")} />
                      ))}
                    </div>
                  </div>
                  <div className="min-w-0 flex-1 pb-20 lg:max-w-[989px] lg:pb-0 lg:pl-8">
                    <ul className="m-0 flex list-none flex-col gap-3 p-0 sm:gap-4 lg:gap-5">
                      {(["a", "b", "c", "d", "e"] as const).map((k) => (
                        <li
                          key={k}
                          className="rounded-lg bg-page-bg p-4 outline outline-1 -outline-offset-1 outline-outline-variant/60 sm:p-5 lg:p-6 dark:bg-surface-container-low"
                        >
                          <div className="flex flex-col gap-4 sm:gap-5 lg:flex-row lg:gap-6">
                            <div
                              className={cn(
                                pulse,
                                "aspect-[16/10] w-full rounded-md lg:h-[280px] lg:w-[min(100%,420px)] lg:max-w-[420px]",
                              )}
                            />
                            <div className="flex min-w-0 flex-1 flex-col justify-between gap-4">
                              <div className="space-y-3">
                                <div className={cn(pulse, "h-4 w-3/4")} />
                                <div className={cn(pulse, "h-5 w-full")} />
                                <div className={cn(pulse, "h-3 w-1/2")} />
                              </div>
                              <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                                <div className={cn(pulse, "h-11 w-full rounded-md sm:w-32")} />
                                <div className={cn(pulse, "h-11 w-full rounded-md sm:w-28")} />
                              </div>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
