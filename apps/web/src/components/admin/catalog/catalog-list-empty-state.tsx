import { AdminEmptyState } from "@/components/admin/admin-empty-state";
import type { ComponentProps } from "react";

type Props = ComponentProps<typeof AdminEmptyState>;

/** Empty state for admin catalog lists. */
export function CatalogListEmptyState(props: Props) {
  return <AdminEmptyState {...props} />;
}
