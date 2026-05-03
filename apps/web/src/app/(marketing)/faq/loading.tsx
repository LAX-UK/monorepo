export default function LegalLoading() {
  return (
    <main
      id="main-content"
      className="mx-auto max-w-3xl px-6 pb-24 pt-[var(--section-pt)]"
      aria-busy="true"
      aria-label="Loading"
    >
      <div className="animate-pulse space-y-6">
        <div className="h-12 w-2/3 rounded bg-surface-container-high" />
        <div className="h-4 w-32 rounded bg-surface-container-high" />
        <div className="space-y-3 pt-6">
          <div className="h-4 w-full rounded bg-surface-container-high" />
          <div className="h-4 w-11/12 rounded bg-surface-container-high" />
          <div className="h-4 w-10/12 rounded bg-surface-container-high" />
          <div className="h-4 w-9/12 rounded bg-surface-container-high" />
          <div className="h-4 w-11/12 rounded bg-surface-container-high" />
        </div>
      </div>
    </main>
  );
}
