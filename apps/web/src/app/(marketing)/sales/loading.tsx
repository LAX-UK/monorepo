export default function SalesIndexLoading() {
  return (
    <main
      id="main-content"
      className="mx-auto max-w-[1920px] bg-surface px-6 pb-24 pt-[var(--section-pt)] md:px-16"
      aria-busy="true"
      aria-label="Loading sales"
    >
      <div className="animate-pulse space-y-10">
        <div className="space-y-3">
          <div className="h-12 w-64 rounded bg-surface-container-high" />
          <div className="h-4 w-full max-w-xl rounded bg-surface-container-high" />
        </div>
        <div className="flex flex-wrap gap-2">
          {(["a", "b", "c", "d"] as const).map((k) => (
            <span
              key={k}
              className="h-10 w-24 rounded-full bg-surface-container-high/80"
              aria-hidden
            />
          ))}
        </div>
        <ul className="space-y-4">
          {(["a", "b", "c", "d", "e"] as const).map((k) => (
            <li
              key={k}
              className="grid grid-cols-1 gap-4 rounded-md border border-outline-variant/15 bg-surface-container-low/40 p-4 sm:grid-cols-[200px_minmax(0,1fr)_120px]"
            >
              <div className="aspect-[4/3] rounded bg-surface-container-high" />
              <div className="space-y-2">
                <div className="h-5 w-3/4 rounded bg-surface-container-high" />
                <div className="h-3 w-1/2 rounded bg-surface-container-high" />
                <div className="h-3 w-1/3 rounded bg-surface-container-high" />
              </div>
              <div className="h-10 rounded bg-surface-container-high" />
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
