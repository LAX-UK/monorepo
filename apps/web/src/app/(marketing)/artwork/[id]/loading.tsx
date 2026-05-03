export default function LotLoading() {
  return (
    <main
      id="main-content"
      className="mx-auto max-w-[1920px] bg-surface px-6 pb-24 pt-[var(--section-pt)] md:px-16"
      aria-busy="true"
      aria-label="Loading lot"
    >
      <div className="animate-pulse space-y-10">
        <div className="h-4 w-72 rounded bg-surface-container-high" />
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <div className="aspect-[4/5] w-full rounded bg-surface-container-high" />
          <div className="space-y-4">
            <div className="h-3 w-24 rounded bg-surface-container-high" />
            <div className="h-10 w-3/4 rounded bg-surface-container-high" />
            <div className="h-4 w-1/2 rounded bg-surface-container-high" />
            <div className="h-32 w-full rounded bg-surface-container-high" />
            <div className="h-12 w-full rounded bg-surface-container-high" />
          </div>
        </div>
      </div>
    </main>
  );
}
