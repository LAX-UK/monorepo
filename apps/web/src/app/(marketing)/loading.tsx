export default function MarketingLoading() {
  return (
    <main
      id="main-content"
      className="mx-auto max-w-[1920px] bg-surface px-6 pb-24 pt-[var(--section-pt)] md:px-16"
      aria-busy="true"
      aria-label="Loading"
    >
      <div className="animate-pulse space-y-10">
        <div className="aspect-[16/9] w-full rounded-lg bg-surface-container-high" />
        <div className="space-y-3">
          <div className="h-8 w-72 rounded bg-surface-container-high" />
          <div className="h-4 w-full max-w-2xl rounded bg-surface-container-high" />
        </div>
        <ul className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {(["a", "b", "c", "d", "e", "f", "g", "h"] as const).map((k) => (
            <li key={k} className="space-y-3">
              <div className="aspect-[4/5] rounded-lg bg-surface-container-high" />
              <div className="h-4 w-3/4 rounded bg-surface-container-high" />
              <div className="h-3 w-1/3 rounded bg-surface-container-high" />
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
