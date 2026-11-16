import { EmptyState } from "@auction/ui/lax/empty-state";
import type { ReactNode } from "react";

type ShopRouteErrorStateProps = {
  title: string;
  description: string;
  actions?: ReactNode;
};

/**
 * A route error boundary's state: the shared kit state as the page's h1, drawn askew in the Shop
 * accent. Silent like every Shop state on first paint. Its modules ship in the shared
 * `lax-empty-state` chunk (next.config.ts), so the boundaries do not each carry a copy.
 */
export function ShopRouteErrorState({ title, description, actions }: ShopRouteErrorStateProps) {
  return (
    <EmptyState
      accent
      variant="error"
      layout="page"
      illustration="askew"
      title={title}
      description={description}
      actions={actions}
      announcement="none"
    />
  );
}
