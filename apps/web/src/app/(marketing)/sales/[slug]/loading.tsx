export default function SaleroomLoading() {
  return (
    <main
      id="main-content"
      className="mx-auto max-w-[1920px] bg-surface px-6 pb-24 pt-[var(--section-pt)] md:px-16"
      aria-busy="true"
      aria-label="Loading sale"
    >
      <div className="animate-pulse space-y-10">
        <div className="aspect-[16/7] w-full rounded bg-surface-container-high" />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <div className="space-y-3">
            <div className="h-8 w-2/3 rounded bg-surface-container-high" />
            <div className="h-4 w-full rounded bg-surface-container-high" />
            <div className="h-4 w-5/6 rounded bg-surface-container-high" />
          </div>
          <div className="space-y-3 rounded border border-outline-variant/15 bg-surface-container-low/40 p-5">
            <div className="h-4 w-1/2 rounded bg-surface-container-high" />
            <div className="h-4 w-3/4 rounded bg-surface-container-high" />
            <div className="h-4 w-2/3 rounded bg-surface-container-high" />
          </div>
        </div>
        <ul className="grid grid-cols-1 gap-7 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {(["a", "b", "c", "d", "e", "f", "g", "h"] as const).map((k) => (
            <li key={k} className="space-y-3">
              <div className="aspect-[4/5] rounded bg-surface-container-high" />
              <div className="h-4 w-3/4 rounded bg-surface-container-high" />
              <div className="h-3 w-1/3 rounded bg-surface-container-high" />
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
