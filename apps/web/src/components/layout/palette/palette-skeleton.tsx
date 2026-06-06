const SKELETON_ROW_IDS = ["one", "two", "three", "four"] as const;

export function PaletteSkeleton() {
  return (
    <div className="space-y-2 px-2 py-3" aria-hidden>
      {SKELETON_ROW_IDS.map((rowId) => (
        <div key={rowId} className="flex animate-pulse items-center gap-3 rounded-md px-2 py-2.5">
          <div className="size-4 shrink-0 rounded bg-surface-container-high" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="h-3.5 w-3/5 rounded bg-surface-container-high" />
            <div className="h-2.5 w-2/5 rounded bg-surface-container-high" />
          </div>
        </div>
      ))}
    </div>
  );
}
