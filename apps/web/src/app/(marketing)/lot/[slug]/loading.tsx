export default function LotLoading() {
  return (
    <main
      id="main-content"
      className="mx-auto max-w-[var(--container-max,1440px)] bg-surface px-6 pb-[var(--page-bottom-padding)] pt-[var(--section-pt)] md:px-16"
      aria-busy="true"
      aria-label="Loading lot"
    >
      <div className="animate-pulse space-y-10">
        <div className="h-4 w-72 rounded bg-surface-container-high" />
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)_minmax(0,440px)] lg:items-start lg:gap-6">
          <div className="hidden space-y-4 lg:block">
            <div className="h-3 w-16 rounded bg-surface-container-high" />
            <div className="h-28 w-full rounded-lg bg-surface-container-high" />
            <div className="h-3 w-20 rounded bg-surface-container-high" />
            <div className="h-24 w-full rounded-lg bg-surface-container-high" />
          </div>
          <div className="space-y-6 lg:col-start-2">
            <div className="aspect-[786/502] w-full max-w-[786px] rounded-lg bg-surface-container-high" />
            <div className="h-10 w-full max-w-[786px] rounded bg-surface-container-high" />
            <div className="h-32 w-full max-w-[786px] rounded bg-surface-container-high" />
          </div>
          <div className="space-y-4 lg:col-start-3">
            <div className="h-10 w-full rounded-full bg-surface-container-high" />
            <div className="h-48 w-full rounded bg-surface-container-high" />
            <div className="h-12 w-full rounded bg-surface-container-high" />
          </div>
        </div>
      </div>
    </main>
  );
}
