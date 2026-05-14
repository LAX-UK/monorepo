import { EmptyState } from "@auction/ui/components/empty-state";
import type { ComponentProps } from "react";

type EmptyProps = ComponentProps<typeof EmptyState>;

/** Dashboard-scoped empty state — wraps UI kit `EmptyState` with consistent outer spacing. */
export function DashboardEmptyState(props: EmptyProps) {
  return (
    <div className="rounded-xl border border-dashed border-outline-variant/25 bg-surface-container-low/30 p-6 sm:p-8">
      <EmptyState {...props} />
    </div>
  );
}
