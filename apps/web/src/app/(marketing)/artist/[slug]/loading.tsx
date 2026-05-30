import { MARKETING_CATALOG_PT, MARKETING_PAGE_SHELL } from "@/lib/marketing/chrome";
import { cn } from "@auction/ui";

export default function ArtistLoading() {
  return (
    <main
      id="main-content"
      className={cn(
        "bg-surface pb-[var(--page-bottom-padding)]",
        MARKETING_CATALOG_PT,
        MARKETING_PAGE_SHELL,
      )}
      aria-busy="true"
      aria-label="Loading artist"
    >
      <div className="animate-pulse space-y-10">
        <div className="space-y-3 pt-4 md:pt-6">
          <div className="h-4 w-40 rounded bg-surface-container-high" />
          <div className="h-3 w-56 rounded bg-surface-container-high" />
        </div>
        <div className="grid grid-cols-1 gap-8 md:grid-cols-[5fr_7fr]">
          <div className="aspect-[4/5] w-full rounded bg-surface-container-high" />
          <div className="space-y-4">
            <div className="h-3 w-32 rounded bg-surface-container-high" />
            <div className="h-16 w-2/3 rounded bg-surface-container-high" />
            <div className="h-4 w-1/2 rounded bg-surface-container-high" />
            <div className="h-32 w-full rounded bg-surface-container-high" />
          </div>
        </div>
        <ul className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
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
