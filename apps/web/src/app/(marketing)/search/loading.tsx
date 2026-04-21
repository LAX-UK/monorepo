export default function SearchLoading() {
  return (
    <main
      id="main-content"
      className="mx-auto max-w-[1920px] bg-surface px-6 pb-24 pt-[var(--section-pt)] md:px-16"
      aria-busy="true"
      aria-label="Loading search"
    >
      <div className="animate-pulse space-y-10">
        <div className="space-y-3">
          <div className="h-10 w-48 rounded bg-surface-container-high" />
          <div className="h-4 w-full max-w-md rounded bg-surface-container-high" />
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="h-12 flex-1 rounded border-b-2 border-outline-variant/20 bg-surface-container-high/50" />
          <div className="h-12 w-full rounded bg-surface-container-high sm:w-32" />
        </div>
        <ul className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {(["a", "b", "c", "d", "e", "f"] as const).map((k) => (
            <li key={k} className="space-y-3">
              <div className="aspect-[4/5] rounded-lg bg-surface-container-high" />
              <div className="h-5 w-4/5 rounded bg-surface-container-high" />
              <div className="h-3 w-1/3 rounded bg-surface-container-high" />
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
