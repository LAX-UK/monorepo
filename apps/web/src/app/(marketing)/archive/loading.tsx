export default function ArchiveLoading() {
  return (
    <main
      id="main-content"
      className="bg-surface px-8 pb-24 pt-32 text-on-surface md:px-20"
      aria-busy="true"
      aria-label="Loading archive"
    >
      <div className="mx-auto max-w-screen-2xl animate-pulse space-y-12">
        <div className="space-y-4">
          <div className="h-14 w-2/3 max-w-md rounded bg-surface-container-high" />
          <div className="h-4 w-48 rounded bg-surface-container-high" />
        </div>
        <div className="h-24 rounded-md bg-surface-container-high" />
        <div className="grid grid-cols-1 gap-x-12 gap-y-16 md:grid-cols-2 lg:grid-cols-3">
          {(["a", "b", "c", "d", "e", "f"] as const).map((k) => (
            <div key={k} className="space-y-4">
              <div className="aspect-4/5 rounded-lg bg-surface-container-high" />
              <div className="h-4 w-3/4 rounded bg-surface-container-high" />
              <div className="h-3 w-1/2 rounded bg-surface-container-high" />
            </div>
          ))}
        </div>
        <div className="flex justify-center gap-4">
          <div className="h-10 w-24 rounded bg-surface-container-high" />
          <div className="h-10 w-24 rounded bg-surface-container-high" />
        </div>
      </div>
    </main>
  );
}
