import {
  AdminEmptyIllustration,
  type AdminEmptyIllustrationKey,
} from "@/components/admin/admin-empty-illustrations";
import { DashboardEmptyState } from "@/components/dashboard/primitives/dashboard-empty-state";
import type { ComponentProps } from "react";

export type AdminEmptyStateProps = ComponentProps<typeof DashboardEmptyState> & {
  illustration?: AdminEmptyIllustrationKey;
};

/** Staff list empty state — thin wrapper over dashboard EmptyState. */
export function AdminEmptyState({ illustration, ...props }: AdminEmptyStateProps) {
  const resolvedIllustration = illustration ? (
    <AdminEmptyIllustration name={illustration} />
  ) : undefined;
  return <DashboardEmptyState variant="quiet" {...props} illustration={resolvedIllustration} />;
}
