import { DashboardEmptyState } from "@/components/dashboard/primitives/dashboard-empty-state";
import type { EmptyStateIllustrationKey } from "@/components/illustrations/empty-state-illustrations";
import type { EmptyStateContext } from "@/lib/ui/empty-state-copy";
import type { ComponentProps } from "react";

/** @deprecated Use EmptyStateIllustrationKey */
export type AdminEmptyIllustrationKey = EmptyStateIllustrationKey;

export type AdminEmptyStateProps = ComponentProps<typeof DashboardEmptyState> & {
  illustration?: EmptyStateIllustrationKey;
  context?: EmptyStateContext;
};

/** Staff list empty state — thin wrapper over dashboard EmptyState. */
export function AdminEmptyState(props: AdminEmptyStateProps) {
  return <DashboardEmptyState variant="quiet" {...props} />;
}
