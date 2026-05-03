export default function ArtistLoading() {
  return (
    <main
      id="main-content"
      className="mx-auto max-w-[1920px] bg-surface px-6 pb-24 pt-[var(--section-pt)] md:px-16"
      aria-busy="true"
      aria-label="Loading artist"
    >
      <div className="animate-pulse space-y-10">
        <div className="h-4 w-72 rounded bg-surface-container-high" />
        <div className="grid grid-cols-1 gap-8 md:grid-cols-[5fr_7fr]">
          <div className="aspect-[4/5] w-full rounded bg-surface-container-high" />
          <div className="space-y-4">
            <div className="h-3 w-32 rounded bg-surface-container-high" />
            <div className="h-16 w-2/3 rounded bg-surface-container-high" />
            <div className="h-4 w-1/2 rounded bg-surface-container-high" />
            <div className="h-32 w-full rounded bg-surface-container-high" />
          </div>
        </div>
        <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {(["a", "b", "c"] as const).map((k) => (
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
