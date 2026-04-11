export default function DashboardLoading() {
  return (
    <div className="max-w-[1920px] animate-pulse space-y-8" aria-busy="true" aria-label="Loading">
      <div className="h-12 w-2/3 rounded bg-surface-container-high" />
      <div className="h-4 w-1/3 rounded bg-surface-container-high" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="h-28 rounded bg-surface-container-high" />
        <div className="h-28 rounded bg-surface-container-high" />
        <div className="h-28 rounded bg-surface-container-high" />
      </div>
      <div className="space-y-6">
        <div className="h-32 rounded bg-surface-container-high" />
        <div className="h-32 rounded bg-surface-container-high" />
      </div>
    </div>
  );
}
