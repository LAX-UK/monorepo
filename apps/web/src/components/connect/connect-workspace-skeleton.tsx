import { Surface } from "@auction/ui/components/surface";

/** Loading skeleton matching ConnectWorkspace embedded layout. */
export function ConnectWorkspaceSkeleton() {
  return (
    <div className="space-y-4" data-testid="connect-workspace-skeleton">
      <Surface variant="section" padding="md" className="animate-pulse space-y-3">
        <div className="h-5 w-32 rounded bg-surface-container-high" />
        <div className="h-4 w-full max-w-md rounded bg-surface-container-high" />
      </Surface>
      <div className="animate-pulse space-y-3 rounded-lg border border-outline-variant/30 p-6">
        <div className="h-4 w-1/3 rounded bg-surface-container-high" />
        <div className="h-48 rounded bg-surface-container-high" />
      </div>
      <div className="animate-pulse space-y-3 rounded-lg border border-outline-variant/30 p-6">
        <div className="h-4 w-1/4 rounded bg-surface-container-high" />
        <div className="h-32 rounded bg-surface-container-high" />
      </div>
    </div>
  );
}
